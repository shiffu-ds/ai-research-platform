import re
import unicodedata


def normalize_text(text: str) -> str:
    """
    Normalize extracted document text.

    Operations:
    - Unicode NFC normalization
    - Remove null bytes
    - Repair line-break hyphenation
    - Collapse repeated spaces
    - Normalize excessive blank lines
    """

    if not text:
        return ""

    text = unicodedata.normalize(
        "NFC",
        text,
    )

    text = text.replace(
        "\x00",
        "",
    )

    # Repair words broken across lines:
    # "artifi-\ncial" -> "artificial"
    text = re.sub(
        r"(\w)-\s*\n\s*(\w)",
        r"\1\2",
        text,
    )

    # Normalize Windows/newline variations
    text = text.replace(
        "\r\n",
        "\n",
    )

    text = text.replace(
        "\r",
        "\n",
    )

    # Collapse spaces/tabs
    text = re.sub(
        r"[ \t]+",
        " ",
        text,
    )

    # Remove spaces around line boundaries
    text = re.sub(
        r" *\n *",
        "\n",
        text,
    )

    # Maximum two consecutive line breaks
    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text,
    )

    return text.strip()