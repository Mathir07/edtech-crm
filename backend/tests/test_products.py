"""Unit and integration tests for Product Categories and Product Catalog."""

import pytest
from fastapi.testclient import TestClient

def test_product_category_and_product_lifecycle(client: TestClient, admin_headers: dict):
    # 1. Create Category
    cat_payload = {
        "name": "Cloud ERP & SIS Solutions",
        "description": "Enterprise campus management modules",
        "status": "Active"
    }
    cat_resp = client.post("/api/v1/product-categories", json=cat_payload, headers=admin_headers)
    assert cat_resp.status_code == 200, cat_resp.text
    category = cat_resp.json()
    cat_id = category["id"]
    assert category["name"] == cat_payload["name"]

    # Duplicate category name error
    dup_resp = client.post("/api/v1/product-categories", json=cat_payload, headers=admin_headers)
    assert dup_resp.status_code == 400

    # 2. List Categories
    list_cat = client.get("/api/v1/product-categories", headers=admin_headers)
    assert list_cat.status_code == 200
    assert any(c["id"] == cat_id for c in list_cat.json())

    # 3. Create Product
    prod_payload = {
        "category_id": cat_id,
        "name": "EduSuite Campus ERP Cloud",
        "code": "TST-ERP-01",
        "description": "Full student information system",
        "type": "Product",
        "unit": "Campus License",
        "base_price": 500000.00,
        "tax_rate": 18.00,
        "status": "Active"
    }
    prod_resp = client.post("/api/v1/products", json=prod_payload, headers=admin_headers)
    assert prod_resp.status_code == 200, prod_resp.text
    product = prod_resp.json()
    prod_id = product["id"]
    assert product["code"] == "TST-ERP-01"
    assert product["category_name"] == cat_payload["name"]

    # Duplicate code rejection
    dup_prod = client.post("/api/v1/products", json=prod_payload, headers=admin_headers)
    assert dup_prod.status_code == 400

    # 4. Get Product
    get_resp = client.get(f"/api/v1/products/{prod_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == prod_payload["name"]

    # 5. Search Products
    search_resp = client.get("/api/v1/products?search=TST-ERP", headers=admin_headers)
    assert search_resp.status_code == 200
    assert len(search_resp.json()) >= 1

    # 6. Update Product
    upd_resp = client.put(f"/api/v1/products/{prod_id}", json={"base_price": 550000.00}, headers=admin_headers)
    assert upd_resp.status_code == 200
    assert upd_resp.json()["base_price"] == 550000.00

    # 7. Toggle status
    status_resp = client.patch(f"/api/v1/products/{prod_id}/status?status=Inactive", headers=admin_headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "Inactive"

    # 8. Soft Delete Product
    del_resp = client.delete(f"/api/v1/products/{prod_id}", headers=admin_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Product deleted"

    # 9. Verify not found after deletion
    get_deleted = client.get(f"/api/v1/products/{prod_id}", headers=admin_headers)
    assert get_deleted.status_code == 404
