-- OrderPilot core schema for Azure SQL / SQL Server (T-SQL).

CREATE TABLE outlet (
    id                  BIGINT IDENTITY(1, 1) PRIMARY KEY,
    code                NVARCHAR(20)   NOT NULL,
    name                NVARCHAR(120)  NOT NULL,
    channel             NVARCHAR(20)   NOT NULL,
    city                NVARCHAR(60)   NOT NULL,
    credit_limit        DECIMAL(14, 2) NOT NULL,
    outstanding_balance DECIMAL(14, 2) NOT NULL CONSTRAINT df_outlet_outstanding DEFAULT 0,
    sales_rep_id        NVARCHAR(64),
    CONSTRAINT uk_outlet_code UNIQUE (code),
    CONSTRAINT ck_outlet_channel CHECK (channel IN ('GROCERY', 'HORECA', 'MODERN_TRADE'))
);

CREATE TABLE product (
    sku        NVARCHAR(40)   NOT NULL PRIMARY KEY,
    name       NVARCHAR(120)  NOT NULL,
    brand      NVARCHAR(60)   NOT NULL,
    category   NVARCHAR(20)   NOT NULL,
    pack_size  NVARCHAR(40)   NOT NULL,
    case_price DECIMAL(12, 2) NOT NULL,
    active     BIT            NOT NULL CONSTRAINT df_product_active DEFAULT 1,
    CONSTRAINT ck_product_category CHECK (category IN ('CARBONATED', 'JUICE', 'WATER', 'ENERGY')),
    CONSTRAINT ck_product_price CHECK (case_price > 0)
);

CREATE TABLE inventory (
    id             BIGINT IDENTITY(1, 1) PRIMARY KEY,
    sku            NVARCHAR(40) NOT NULL CONSTRAINT fk_inventory_product REFERENCES product (sku),
    warehouse      NVARCHAR(3)  NOT NULL,
    on_hand_cases  INT          NOT NULL,
    reserved_cases INT          NOT NULL CONSTRAINT df_inventory_reserved DEFAULT 0,
    version        BIGINT       NOT NULL CONSTRAINT df_inventory_version DEFAULT 0,
    CONSTRAINT uk_inventory_sku_wh UNIQUE (sku, warehouse),
    CONSTRAINT ck_inventory_wh CHECK (warehouse IN ('DXB', 'AUH', 'SHJ')),
    CONSTRAINT ck_inventory_qty CHECK (on_hand_cases >= 0 AND reserved_cases >= 0 AND reserved_cases <= on_hand_cases)
);

CREATE TABLE promotion (
    id           BIGINT IDENTITY(1, 1) PRIMARY KEY,
    sku          NVARCHAR(40)  NOT NULL CONSTRAINT fk_promotion_product REFERENCES product (sku),
    channel      NVARCHAR(20),
    discount_pct DECIMAL(5, 2) NOT NULL,
    min_cases    INT           NOT NULL CONSTRAINT df_promotion_min DEFAULT 1,
    valid_from   DATE          NOT NULL,
    valid_to     DATE          NOT NULL,
    description  NVARCHAR(200) NOT NULL,
    CONSTRAINT ck_promotion_pct CHECK (discount_pct > 0 AND discount_pct < 100),
    CONSTRAINT ck_promotion_dates CHECK (valid_to >= valid_from)
);
CREATE INDEX ix_promotion_sku ON promotion (sku);

CREATE SEQUENCE order_no_seq AS BIGINT START WITH 1 INCREMENT BY 1;

CREATE TABLE sales_order (
    id              BIGINT IDENTITY(1, 1) PRIMARY KEY,
    order_no        NVARCHAR(20)      NOT NULL,
    outlet_id       BIGINT            NOT NULL CONSTRAINT fk_sales_order_outlet REFERENCES outlet (id),
    status          NVARCHAR(20)      NOT NULL,
    subtotal        DECIMAL(14, 2)    NOT NULL,
    discount        DECIMAL(14, 2)    NOT NULL,
    total           DECIMAL(14, 2)    NOT NULL,
    source          NVARCHAR(10)      NOT NULL,
    created_by      NVARCHAR(64)      NOT NULL,
    created_at      DATETIMEOFFSET(6) NOT NULL,
    notes           NVARCHAR(500),
    ai_summary      NVARCHAR(4000),
    idempotency_key NVARCHAR(100),
    version         BIGINT            NOT NULL CONSTRAINT df_sales_order_version DEFAULT 0,
    CONSTRAINT uk_sales_order_no UNIQUE (order_no),
    CONSTRAINT ck_sales_order_status CHECK (status IN ('PENDING_APPROVAL', 'CONFIRMED', 'DISPATCHED', 'CANCELLED')),
    CONSTRAINT ck_sales_order_source CHECK (source IN ('UI', 'AI_AGENT'))
);
-- SQL Server UNIQUE constraints allow a single NULL, so idempotency keys use a filtered unique index.
CREATE UNIQUE INDEX uk_sales_order_idem ON sales_order (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_sales_order_created ON sales_order (created_at);
CREATE INDEX ix_sales_order_outlet ON sales_order (outlet_id);
CREATE INDEX ix_sales_order_status ON sales_order (status);

CREATE TABLE order_line (
    id           BIGINT IDENTITY(1, 1) PRIMARY KEY,
    order_id     BIGINT         NOT NULL CONSTRAINT fk_order_line_order REFERENCES sales_order (id),
    line_no      INT            NOT NULL,
    sku          NVARCHAR(40)   NOT NULL,
    product_name NVARCHAR(120)  NOT NULL,
    qty_cases    INT            NOT NULL,
    unit_price   DECIMAL(12, 2) NOT NULL,
    discount_pct DECIMAL(5, 2)  NOT NULL,
    line_total   DECIMAL(14, 2) NOT NULL,
    CONSTRAINT ck_order_line_qty CHECK (qty_cases > 0)
);
CREATE INDEX ix_order_line_order ON order_line (order_id);
