from rag_m2.preprocessing.normalizer import normalize_text


def test_normalizer_repairs_hyphenated_line_breaks():

    text = "artifi-\ncial intelligence"

    result = normalize_text(
        text
    )

    assert result == (
        "artificial intelligence"
    )


def test_normalizer_collapses_spaces():

    text = "AI     research\t\tplatform"

    result = normalize_text(
        text
    )

    assert result == (
        "AI research platform"
    )