from urllib.parse import urlparse


HIGH_AUTHORITY_SUFFIXES = (
    ".gov",
    ".gov.pk",
    ".edu",
    ".ac.uk",
)

HIGH_REPUTATION_DOMAINS = {
    "who.int",
    "worldbank.org",
    "un.org",
    "nih.gov",
    "ncbi.nlm.nih.gov",
    "nature.com",
    "science.org",
}


def hostname_from_url(
    url: str,
) -> str:
    hostname = (
        urlparse(url)
        .hostname
        or ""
    )

    return hostname.lower()


def authority_level_for_url(
    url: str,
) -> float:
    hostname = hostname_from_url(
        url
    )

    if hostname in HIGH_REPUTATION_DOMAINS:
        return 0.95

    if hostname.endswith(
        HIGH_AUTHORITY_SUFFIXES
    ):
        return 0.90

    return 0.60


def publisher_reputation_for_url(
    url: str,
) -> float:
    hostname = hostname_from_url(
        url
    )

    if hostname in HIGH_REPUTATION_DOMAINS:
        return 0.95

    if hostname.endswith(
        HIGH_AUTHORITY_SUFFIXES
    ):
        return 0.85

    return 0.55