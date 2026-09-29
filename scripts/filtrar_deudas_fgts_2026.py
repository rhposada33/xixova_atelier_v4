#!/usr/bin/env python3
"""Filtra deudas FGTS de empresas inscritas en 2026.

Lee todos los archivos arquivo_lai_FGTS_*.csv de Dados_abertos_FGTS y genera
un CSV con deudas entre R$ 100.000 y R$ 3.000.000, ambos límites incluidos.
"""

import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
INPUT_DIR = BASE_DIR / "Dados_abertos_FGTS"
OUTPUT_FILE = BASE_DIR / "empresas_fgts_2026_100k_3m.csv"


def read_csv(path: Path) -> list[dict[str, str]]:
    """Lee un CSV intentando las codificaciones usadas por esta base."""
    for encoding in ("utf-8-sig", "latin1", "cp1252"):
        try:
            with path.open("r", encoding=encoding, newline="") as stream:
                return list(csv.DictReader(stream, delimiter=";"))
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"No se pudo leer {path}")


def main() -> None:
    files = sorted(INPUT_DIR.glob("arquivo_lai_FGTS_*.csv"))
    if not files:
        raise FileNotFoundError(f"No se encontraron CSV en {INPUT_DIR}")

    rows = [row for path in files for row in read_csv(path)]
    filtered = []
    total = Decimal("0")
    for row in rows:
        try:
            date = datetime.strptime(row["DATA_INSCRICAO"].strip(), "%d/%m/%Y")
            value = Decimal(row["VALOR_CONSOLIDADO"].strip().replace(",", "."))
        except (KeyError, ValueError, InvalidOperation):
            continue
        if (
            row.get("TIPO_PESSOA", "").strip() == "Pessoa jurídica"
            and date.year == 2026
            and Decimal("100000") <= value <= Decimal("3000000")
        ):
            filtered.append(row)
            total += value

    with OUTPUT_FILE.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=filtered[0].keys() if filtered else rows[0].keys(), delimiter=";")
        writer.writeheader()
        writer.writerows(filtered)
    print(f"Archivos leídos: {len(files)}")
    print(f"Registros filtrados: {len(filtered):,}".replace(",", "."))
    print(f"Valor total: R$ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    print(f"Archivo generado: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
