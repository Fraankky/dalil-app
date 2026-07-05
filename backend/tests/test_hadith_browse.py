import ast
from pathlib import Path

HADITH_API = Path(__file__).resolve().parents[1] / "app" / "api" / "hadith.py"


def test_hadith_api_does_not_reference_missing_book_id() -> None:
    source = HADITH_API.read_text()

    assert "Hadith.book_id" not in source
    assert "Hadith.chapter_id" in source


def test_get_hadith_list_book_id_parameter_is_nullable_int() -> None:
    source = HADITH_API.read_text()
    tree = ast.parse(source)

    func = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "get_hadith_list"
    )
    book_id = next(arg for arg in func.args.args + func.args.posonlyargs if arg.arg == "book_id")
    annotation = ast.unparse(book_id.annotation)

    assert "None" in annotation
    assert "int" in annotation
