from app.models.schemas import StatsResponse


def test_stats_response_includes_embedding_counts() -> None:
    response = StatsResponse(
        total_verses=6236,
        total_surahs=114,
        total_hadith=100,
        total_collections=2,
        total_embeddings=6336,
        quran_embeddings=6236,
        hadith_embeddings=100,
        model_name="intfloat/multilingual-e5-large-instruct",
        model_dim=1024,
    )

    assert response.total_embeddings == 6336
    assert response.quran_embeddings == 6236
    assert response.hadith_embeddings == 100
