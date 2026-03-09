-- Banana Tracker App - Supabase Schema --

-- 1. Farms Table
CREATE TABLE public.farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "farmCode" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "prodHas" NUMERIC,
    "activeHas" NUMERIC,
    "location" TEXT,
    "elevation" TEXT,
    "farmType" TEXT,
    "company" TEXT,
    "otherGrouping" TEXT,
    "status" TEXT,
    "pointOfDelivery" TEXT,
    "physicalPhName" TEXT,
    "physicalPhAddress" TEXT,
    "brand" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "lastModified" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Arrivals (On-ground Inventory) Table
CREATE TABLE public.arrivals (
    id TEXT PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "farmName" TEXT,
    "farmCode" TEXT,
    "driverName" TEXT,
    "plateNumber" TEXT,
    "deliveryReceipt" TEXT,
    "dateOfPacking" DATE,
    "dateTimeArrive" TIMESTAMP WITH TIME ZONE,
    "brand" TEXT,
    "ccClass" TEXT,
    "productSpecsCode" TEXT,
    "quantity" NUMERIC,
    "typeId" TEXT,
    "dateTimeEncoded" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Samplings Table
CREATE TABLE public.samplings (
    id TEXT PRIMARY KEY,
    "farmCode" TEXT,
    "farmName" TEXT,
    "brand" TEXT,
    "inspector" TEXT,
    "date" DATE,
    "totalBoxes" NUMERIC,
    "boxes" JSONB,
    "overallDecision" TEXT,
    "encodedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Containers Table
CREATE TABLE public.containers (
    id TEXT PRIMARY KEY,
    "brand" TEXT,
    "reeferName" TEXT,
    "reeferNo" TEXT,
    "sealNo" TEXT,
    "destination" TEXT,
    "voyageNo" TEXT,
    "shipper" TEXT,
    "portOfLoading" TEXT,
    "bpiSticker" TEXT,
    "drNo" TEXT,
    "week" TEXT,
    "reeferVanNo" TEXT,
    "timeArrHub" TEXT,
    "timeStarted" TEXT,
    "timeEnded" TEXT,
    "driver" TEXT,
    "plateNo" TEXT,
    "temperature" TEXT,
    "timeDeparted" TEXT,
    "totalBoxes" NUMERIC DEFAULT 0,
    "stuffedItems" JSONB DEFAULT '[]'::jsonb,
    "dateCreated" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
