import asyncio
import os
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..auth import get_current_user

router = APIRouter(prefix="/voice", tags=["voice"])

# Lazy singleton — model load takes ~3s on Pi; cached after first call
_whisper_model = None
_whisper_lock = asyncio.Lock()


def _load_whisper():
    """Load openai-whisper model synchronously (called in executor thread).

    openai-whisper uses ffmpeg subprocess for audio decoding, so it has no
    build-time dependency on the `av` C extension — any platform with the
    ffmpeg binary available will work.
    """
    global _whisper_model
    if _whisper_model is None:
        import whisper  # openai-whisper package

        _whisper_model = whisper.load_model("base.en")
    return _whisper_model


def _transcribe(model, audio_path: str) -> str:
    """Run whisper transcription synchronously."""
    result = model.transcribe(audio_path, language="en", fp16=False)
    return result["text"].strip()


@router.post("")
async def transcribe_audio(
    file: UploadFile = File(...),
    _current_user: str = Depends(get_current_user),
):
    """Transcribe an uploaded audio file using local openai-whisper (base.en).

    Returns ``{"text": "<transcription>"}`` on success.
    Accepts any format ffmpeg can decode (WebM, WAV, MP4, OGG, etc.).
    """
    try:
        filename = file.filename or "audio.webm"
        suffix = os.path.splitext(filename)[1] or ".webm"

        audio_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            loop = asyncio.get_event_loop()

            async with _whisper_lock:
                model = await loop.run_in_executor(None, _load_whisper)

            transcribed_text = await loop.run_in_executor(
                None, _transcribe, model, tmp_path
            )
        finally:
            os.unlink(tmp_path)

        return {"text": transcribed_text}

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {exc}",
        ) from exc
