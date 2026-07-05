from data.eval.evaluate import mrr_at_k, normalize_result_id, recall_at_k


def test_normalize_result_id_formats_quran_reference() -> None:
    result = {"type": "quran", "surah_number": 2, "verse_number": 153}

    assert normalize_result_id(result) == "quran:2:153"


def test_normalize_result_id_formats_hadith_reference() -> None:
    result = {"type": "hadith", "collection_slug": "bukhari", "hadith_number": "1"}

    assert normalize_result_id(result) == "hadith:bukhari:1"


def test_recall_at_k_counts_relevant_results_within_limit() -> None:
    returned = ["quran:1:1", "quran:2:153", "hadith:bukhari:1"]
    relevant = {"quran:2:153", "hadith:bukhari:1", "quran:3:200"}

    assert recall_at_k(returned, relevant, k=2) == 1 / 3


def test_mrr_at_k_returns_reciprocal_rank_of_first_relevant_hit() -> None:
    returned = ["quran:1:1", "quran:2:153", "hadith:bukhari:1"]
    relevant = {"hadith:bukhari:1"}

    assert mrr_at_k(returned, relevant, k=3) == 1 / 3


def test_mrr_at_k_returns_zero_when_no_relevant_hit() -> None:
    assert mrr_at_k(["quran:1:1"], {"quran:2:153"}, k=10) == 0.0
