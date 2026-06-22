def test_celery_app_imports() -> None:
    from app.celery_app import celery_app

    assert celery_app.main == "dalil"


def test_build_document_text_prefers_arabic_and_appends_translation() -> None:
    from app.tasks.embeddings import build_document_text

    text = build_document_text("الصبر جميل", "Patience is beautiful")

    assert text == "الصبر جميل\nPatience is beautiful"


def test_build_document_text_omits_empty_translation() -> None:
    from app.tasks.embeddings import build_document_text

    text = build_document_text("الحمد لله", "")

    assert text == "الحمد لله"
