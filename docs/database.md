-- 1. Create the Users table first (Parent table)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,        -- Auto-incrementing integer
    email VARCHAR(255) NOT NULL,
    fname VARCHAR(100),
    mname VARCHAR(100),
    lname VARCHAR(100),
    role VARCHAR(50),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL, -- Must be UNIQUE to be a foreign key elsewhere
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Create the Systems Config table (Parent table)
CREATE TABLE systems_config (
    system_id SERIAL PRIMARY KEY,
    system_name VARCHAR(255),
    system_description TEXT,
    database_type VARCHAR(50),
    database_host VARCHAR(255),
    database_port INT,
    database_name VARCHAR(255),
    database_user VARCHAR(255),
    database_password VARCHAR(255),
    database_ssl BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    external_base_url VARCHAR(512),  -- Base URL for proxying (e.g. http://localhost:3001/api)
    api_path_slug VARCHAR(64) UNIQUE, -- When set, proxied at /api/:api_path_slug/* (e.g. funtalk)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2b. System routes (endpoints) for external systems - migrated from external backends
CREATE TABLE system_routes (
    route_id SERIAL PRIMARY KEY,
    system_id INT NOT NULL REFERENCES systems_config(system_id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path_pattern VARCHAR(512) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create User Permissions table
-- Links Users and Systems
CREATE TABLE user_permission (
    user_permission_id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL,
    system_id INT NOT NULL,
    permission VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraints
    CONSTRAINT fk_up_user 
        FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    CONSTRAINT fk_up_system 
        FOREIGN KEY (system_id) REFERENCES systems_config(system_id) ON DELETE CASCADE
);

-- 4. Create API Token table
-- Note: Diagram marks 'permissions' as an FK and draws a line from systems_config
CREATE TABLE api_token (
    api_token_id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL,
    token_name VARCHAR(255),
    token_hash VARCHAR(512) NOT NULL, -- Hashes usually require long strings
    token_prefix VARCHAR(50),
    permissions INT, -- Diagram marks this as FK to systems_config
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key Constraints
    CONSTRAINT fk_token_user 
        FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    CONSTRAINT fk_token_system 
        FOREIGN KEY (permissions) REFERENCES systems_config(system_id) ON DELETE SET NULL
);