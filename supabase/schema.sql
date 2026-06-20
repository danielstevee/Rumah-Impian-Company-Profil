-- ============================================
-- RUMAH IMPIAN - Database Schema
-- ============================================

-- Enable RLS by default
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'agent', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone" 
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. PROPERTIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    price_type TEXT DEFAULT 'jual' CHECK (price_type IN ('jual', 'sewa')),
    property_type TEXT NOT NULL CHECK (property_type IN ('rumah', 'apartemen', 'villa', 'ruko', 'tanah', 'kost')),
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'rented', 'pending')),
    
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    province TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    bedrooms INT DEFAULT 0,
    bathrooms INT DEFAULT 0,
    building_area INT,
    land_area INT,
    floors INT DEFAULT 1,
    carport INT DEFAULT 0,
    
    features JSONB DEFAULT '[]',
    
    images JSONB DEFAULT '[]',
    thumbnail TEXT,
    
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    view_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Properties are viewable by everyone" 
    ON properties FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create properties" 
    ON properties FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = agent_id);

CREATE POLICY "Owners/agents can update their properties" 
    ON properties FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = agent_id);

CREATE POLICY "Owners/agents can delete their properties" 
    ON properties FOR DELETE USING (auth.uid() = owner_id OR auth.uid() = agent_id);

CREATE POLICY "Admin full access" 
    ON properties FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 3. PROPERTY INQUIRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inquiries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_phone TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inquiries" 
    ON inquiries FOR SELECT USING (auth.uid() = sender_id);

CREATE POLICY "Property owners can view inquiries on their properties" 
    ON inquiries FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE id = inquiries.property_id 
            AND (owner_id = auth.uid() OR agent_id = auth.uid())
        )
    );

CREATE POLICY "Anyone can create inquiries" 
    ON inquiries FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites" 
    ON favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" 
    ON favorites FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 5. CONTACT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send contact messages" 
    ON contact_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can view contact messages" 
    ON contact_messages FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 6. VIEWS/ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS property_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log views" 
    ON property_views FOR INSERT WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_property ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_property_views_property ON property_views(property_id);

-- Full text search
ALTER TABLE properties ADD COLUMN IF NOT EXISTS search_vector tsvector 
    GENERATED ALWAYS AS (
        setweight(to_tsvector('indonesian', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('indonesian', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('indonesian', coalesce(city, '')), 'C') ||
        setweight(to_tsvector('indonesian', coalesce(address, '')), 'D')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_properties_search ON properties USING GIN(search_vector);

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION increment_property_views(property_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE properties SET view_count = view_count + 1 WHERE id = property_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_properties(
    search_query TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_min_price BIGINT DEFAULT NULL,
    p_max_price BIGINT DEFAULT NULL,
    p_bedrooms INT DEFAULT NULL,
    p_status TEXT DEFAULT 'available'
)
RETURNS SETOF properties AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM properties
    WHERE 
        (p_status IS NULL OR status = p_status)
        AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
        AND (p_type IS NULL OR property_type = p_type)
        AND (p_min_price IS NULL OR price >= p_min_price)
        AND (p_max_price IS NULL OR price <= p_max_price)
        AND (p_bedrooms IS NULL OR bedrooms >= p_bedrooms)
        AND (search_query IS NULL OR search_vector @@ plainto_tsquery('indonesian', search_query))
    ORDER BY 
        is_featured DESC,
        created_at DESC;
END;
$$ LANGUAGE plpgsql;