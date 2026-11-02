import asyncio
import os
import re
from typing import Callable, Awaitable, List, Tuple
from ..config import settings

PROGRESS_RE = re.compile(r"(\d{1,3})%")


def validate_output_directory(target_dir: str) -> str:
    cleaned = (target_dir or "").strip()
    if not cleaned or ".." in cleaned or "\x00" in cleaned:
        raise ValueError("Forbidden path traversal or invalid characters in output_dir.")
    normalized = os.path.normpath(cleaned)
    allowed = any(
        normalized == root or normalized.startswith(root + "/")
        for root in settings.allowed_output_roots
    )
    if not allowed:
        raise ValueError(
            f"Output directory '{normalized}' is outside permitted roots: {settings.allowed_output_roots}"
        )
    return normalized


def build_lucidadl_cli_args(
    executable: str,
    entity_type: str,
    source_url: str,
    output_dir: str,
    requested_format: str,
) -> List[str]:
    if entity_type not in ("track", "album"):
        raise ValueError(f"Unsupported entity_type: {entity_type}")
    if requested_format not in settings.supported_formats:
        raise ValueError(f"Unsupported format: {requested_format}")
    safe_dir = validate_output_directory(output_dir)
    return [
        executable,
        entity_type,
        source_url,
        "--output",
        safe_dir,
        "--format",
        requested_format,
        "--no-tui",
    ]


async def execute_lucidadl_job(
    entity_type: str,
    source_url: str,
    output_dir: str,
    requested_format: str,
    on_progress: Callable[[int | None, str, str], Awaitable[None]],
) -> Tuple[int, List[str], str, str]:
    """
    Executes lucidadl safely via asyncio.create_subprocess_exec without shell=True.
    Captures stdout/stderr streams continuously, parses progress if emitted, and
    verifies real output files on disk before marking success.
    """
    binary = settings.resolve_lucidadl_binary()
    if not binary:
        raise FileNotFoundError(
            "Executable 'lucidadl' or 'lucida' not found in PATH or LUCIDADL_BIN. "
            "Run ./diagnose.sh in Termux Ubuntu PRoot to verify installation."
        )

    safe_dir = validate_output_directory(output_dir)
    os.makedirs(safe_dir, exist_ok=True)
    before_files = set(os.listdir(safe_dir))

    cmd_args = build_lucidadl_cli_args(
        binary, entity_type, source_url, safe_dir, requested_format
    )

    proc = await asyncio.create_subprocess_exec(
        *cmd_args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout_lines: List[str] = []
    stderr_lines: List[str] = []

    async def read_stream(stream: asyncio.StreamReader | None, is_err: bool):
        if stream is None:
            return
        while True:
            line_bytes = await stream.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").rstrip()
            if is_err:
                stderr_lines.append(line)
                await on_progress(None, line, "stderr")
            else:
                stdout_lines.append(line)
                match = PROGRESS_RE.search(line)
                pct = min(100, int(match.group(1))) if match else None
                await on_progress(pct, line, "stdout")

    try:
        await asyncio.wait_for(
            asyncio.gather(
                read_stream(proc.stdout, False),
                read_stream(proc.stderr, True),
                proc.wait(),
            ),
            timeout=settings.job_timeout_seconds,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise TimeoutError(f"lucidadl timed out after {settings.job_timeout_seconds}s")
    except asyncio.CancelledError:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
        raise

    after_files = set(os.listdir(safe_dir))
    created_files = sorted(
        os.path.join(safe_dir, f) for f in (after_files - before_files)
    )
    return (
        proc.returncode or 0,
        created_files,
        "\n".join(stdout_lines),
        "\n".join(stderr_lines),
    )
