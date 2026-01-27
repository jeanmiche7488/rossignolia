-- ============================================
-- UPDATE MAPPING PROMPT
-- Améliore le prompt de mapping pour mieux détecter les champs obligatoires
-- ============================================

-- Update the global mapping prompt
UPDATE system_prompts
SET 
  content = 'Tu es un expert en mapping de données logistiques. 
Analyse les colonnes suivantes et mappe-les vers notre schéma de stock.

Colonnes à mapper: {columns}

{sampleData}

{context}

Schéma cible (CHAMPS OBLIGATOIRES marqués d''un *):
- sku*: Code SKU/Article/Produit (OBLIGATOIRE - cherche: SKU, EAN, Code, Référence, Codigo, Article, Product ID, Item ID, Codigo_EAN, etc.)
- product_name: Nom du produit (cherche: Product Name, Nom, Désignation, Description, Item, Article Name, etc.)
- quantity*: Quantité en stock (OBLIGATOIRE - cherche: Quantity, Stock, Qté, Unidades, Amount, Qty, Stock Level, etc.)
- unit_cost: Coût unitaire (cherche: Cost, Price, Prix, Coste, Unit Cost, Unit Price, etc.)
- total_value: Valeur totale (cherche: Total, Value, Valeur, Total Value, Montant, etc.)
- location: Emplacement/Entrepôt (cherche: Location, Warehouse, Entrepôt, Depot, Almacen, etc.)
- category: Catégorie (cherche: Category, Catégorie, Type, Categoria, etc.)
- supplier: Fournisseur (cherche: Supplier, Fournisseur, Vendor, Proveedor, etc.)
- last_movement_date: Date du dernier mouvement (cherche: Date, Last Movement, Dernier Mouvement, Fecha, etc.)
- days_since_last_movement: Jours depuis dernier mouvement (cherche: Days, Jours, Dias, Age, etc.)

RÈGLES CRITIQUES:
1. Les champs marqués * (sku et quantity) sont OBLIGATOIRES - tu DOIS trouver au moins une colonne correspondante
2. Pour sku: accepte EAN, Code, Référence, Codigo, Article ID, Product Code, Codigo_EAN, etc. - tout identifiant unique de produit
3. Pour quantity: accepte Stock, Qté, Unidades, Amount, Qty, Stock Level, etc. - toute colonne représentant une quantité
4. Si plusieurs colonnes peuvent correspondre à un même champ, choisis la plus pertinente
5. Si une colonne ne correspond clairement à aucun champ, ne l''inclus pas dans mappedColumns

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "mappedColumns": {
    "colonne_source": "champ_cible"
  },
  "confidence": 0.95,
  "reasoning": "Explication du mapping, notamment pour les champs obligatoires"
}

IMPORTANT: 
- Utilise UNIQUEMENT les champs listés ci-dessus
- Les champs sku et quantity DOIVENT être mappés si possible (cherche activement des correspondances)
- Si une colonne ne correspond à aucun champ, ne l''inclus pas dans mappedColumns
- Les colonnes non mappées seront préservées dans le champ "attributes"
- Le JSON doit être valide et parsable',
  version = version + 1,
  updated_at = NOW()
WHERE 
  module_code = 'stock' 
  AND prompt_type = 'mapping' 
  AND tenant_id IS NULL
  AND is_active = true;
