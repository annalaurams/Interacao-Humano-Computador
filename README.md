# 📘 Fast Mart – IHC

---

## 🛒 Vendas  

### Cadastrar Venda  
**POST** `http://localhost:3333/sales`  

```json
{
  "date": "2024-08-01",
  "description": "Venda de vários produtos",
  "payment_method": "Pix",
  "products": [
    {
      "code": 12.0,
      "quantity": 1
    }
  ]
}
```

---

## 📦 Produtos  

### Criar Produto  
**POST** `http://localhost:3333/products`  

```json
{
  "name": "Leite",
  "unit_of_measure": "litro",
  "purchase_price": 3.0,
  "quantity_per_unit": 2.0,
  "sale_price": 8,
  "expiry_date": "2025-05-20T00:00:00.000Z",
  "supplier": "Danone",
  "code": 1
}
```

### Procurar Produto Específico  
**POST** `http://localhost:3333/products/search`  

```json
{
  "name": "Milho"
}
```

---

## 💰 Finanças  

### Cadastrar Produto (Geral e Específico)  
**POST** `http://localhost:3333/finances`  

```json
{
  "date": "2024-08-01",
  "description": "Venda de produto X",
  "value": 100.0,
  "quantity": 10,
  "expiry_date": "2024-08-24",
  "payment_method": "Dinheiro",
  "product": {
    "name": "Iorgute",
    "unit_of_measure": "litro",
    "purchase_price": 3.0,
    "quantity_per_unit": 5.0,
    "sale_price": 8,
    "expiry_date": "2025-05-20T00:00:00.000Z",
    "supplier": "Danone",
    "code": 2
  }
}
```

---

## 🏢 Empresas  

### Criar Empresa  
**POST** `http://localhost:3333/companys`  

```json
{
  "comp_name": "ABC",
  "comp_cnpj": "1456",
  "comp_employees": "101",
  "address": {
    "street": "Rua Guape",
    "number": "10",
    "district": "Bela VIsta",
    "city": "Divinopolis",
    "state": "MG"
  }
}
```

---

## 👤 Usuários  

### Criar Usuário  
**POST** `http://localhost:3333/users/`  

```json
{
  "name": "Anna",
  "password": "54321",
  "email": "anna@gmail.com",
  "code": 3,
  "birthday_date": "2003-02-27",
  "cpf": "876543210",
  "phone": "37987654321",
  "education": "triste",
  "company_id": 1
}
```
