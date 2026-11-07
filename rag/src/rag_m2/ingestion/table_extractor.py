from pathlib import Path

import pdfplumber

from rag_m2.config import settings
from rag_m2.ingestion.models import ExtractedTable


class TableExtractor:
    def extract(
        self,
        file_path: str | Path,
    ) -> list[ExtractedTable]:

        extracted_tables: list[
            ExtractedTable
        ] = []

        with pdfplumber.open(
            file_path
        ) as document:

            for page_number, page in enumerate(
                document.pages,
                start=1,
            ):

                tables = page.find_tables()

                for table_index, table in enumerate(
                    tables,
                ):

                    rows = (
                        table.extract()
                        or []
                    )

                    total_cells = 0
                    unresolved_cells = 0

                    for row in rows:

                        if row is None:
                            continue

                        for cell in row:

                            total_cells += 1

                            if (
                                cell is None
                                or not str(
                                    cell
                                ).strip()
                            ):
                                unresolved_cells += 1

                    if total_cells > 0:
                        unresolved_ratio = (
                            unresolved_cells
                            / total_cells
                        )
                    else:
                        unresolved_ratio = 0.0

                    if (
                        unresolved_ratio
                        > settings.table_unresolved_threshold
                    ):
                        status = "PARTIAL"
                    else:
                        status = "COMPLETE"

                    bbox = None

                    if table.bbox:
                        bbox = tuple(
                            float(value)
                            for value
                            in table.bbox
                        )

                    cell_bboxes = []

                    for cell_bbox in (
                        table.cells
                        or []
                    ):
                        cell_bboxes.append(
                            tuple(
                                float(value)
                                for value
                                in cell_bbox
                            )
                        )

                    extracted_tables.append(
                        ExtractedTable(
                            page_number=page_number,
                            table_index=table_index,
                            bbox=bbox,
                            cell_bboxes=cell_bboxes,
                            rows=rows,
                            unresolved_cells=(
                                unresolved_cells
                            ),
                            total_cells=(
                                total_cells
                            ),
                            unresolved_ratio=(
                                unresolved_ratio
                            ),
                            extraction_status=(
                                status
                            ),
                        )
                    )

        return extracted_tables