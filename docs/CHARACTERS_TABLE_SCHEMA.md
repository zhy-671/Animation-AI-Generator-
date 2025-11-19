# Characters Table Schema

## Table: `anim_characters`

This table stores character information for each storyboard project. Characters are bound to projects via `project_id` and to users via `user_id`.

### Table Structure

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `project_id` | UUID | NOT NULL | - | Foreign key to `anim_storyboard_projects(id)` |
| `user_id` | UUID | NOT NULL | - | Foreign key to `auth.users(id)` |
| `name` | TEXT | NOT NULL | - | Character name |
| `role` | TEXT | NULL | - | Character role/position |
| `age` | TEXT | NULL | - | Character age |
| `gender` | TEXT | NULL | - | Character gender |
| `description` | TEXT | NULL | - | Character description |
| `appearance` | JSONB | NULL | `{}` | Appearance details (see structure below) |
| `clothing_style` | JSONB | NULL | `{}` | Clothing details (see structure below) |
| `personality_traits` | TEXT | NULL | - | Personality traits |
| `background` | TEXT | NULL | - | Character background |
| `skills_abilities` | TEXT[] | NULL | `[]` | Array of skills and abilities |
| `relationships` | TEXT[] | NULL | `[]` | Array of relationships |
| `visual_reference_prompt` | TEXT | NULL | - | Visual reference prompt |
| `pose_references` | TEXT[] | NULL | `[]` | Array of pose references |
| `image_url` | TEXT | NULL | - | Character image URL |
| `image_generation_prompt` | TEXT | NULL | - | Image generation prompt |
| `resolution` | TEXT | NULL | - | Image resolution (format: "width*height", e.g., "1920*1080") |
| `visual_style` | TEXT | NULL | - | Visual style (e.g., "2d", "3d") |
| `art_setting` | TEXT | NULL | - | Aspect ratio (e.g., "16:9", "4:3", "1:1") |
| `created_at` | TIMESTAMP WITH TIME ZONE | NULL | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NULL | `NOW()` | Last update timestamp |

### JSONB Structures

#### `appearance` JSONB Structure
```json
{
  "hair_color": "string",
  "eye_color": "string",
  "hair_style": "string",
  "height": "string",
  "build": "string",
  "skin_tone": "string",
  "facial_features": "string",
  "distinct_marks": "string"
}
```

#### `clothing_style` JSONB Structure
```json
{
  "style": "string",
  "accessories": "string",
  "footwear": "string"
}
```

### Indexes

- `idx_anim_characters_project_id` on `project_id` - For faster project-based queries
- `idx_anim_characters_user_id` on `user_id` - For RLS and user-based queries
- `idx_anim_characters_name` on `name` - For faster name searches

### Row Level Security (RLS)

RLS is enabled on this table. Policies:

1. **SELECT**: Users can only view their own characters
2. **INSERT**: Users can only insert characters for themselves
3. **UPDATE**: Users can only update their own characters
4. **DELETE**: Users can only delete their own characters

### Triggers

- `update_anim_characters_updated_at`: Automatically updates `updated_at` timestamp on row update

### Foreign Key Constraints

- `project_id` → `anim_storyboard_projects(id)` ON DELETE CASCADE
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### Usage Example

```sql
-- Insert a new character
INSERT INTO anim_characters (
  project_id,
  user_id,
  name,
  role,
  appearance,
  clothing_style,
  image_url,
  resolution,
  visual_style,
  art_setting
) VALUES (
  'project-uuid',
  'user-uuid',
  'Kaito',
  'Main Character',
  '{"hair_color": "black", "eye_color": "brown"}'::jsonb,
  '{"style": "casual", "accessories": "watch"}'::jsonb,
  'https://example.com/image.jpg',
  '1920*1080',
  '2d',
  '16:9'
);

-- Query characters for a project
SELECT * FROM anim_characters WHERE project_id = 'project-uuid';
```

### Migration File

The SQL migration file is located at: `supabase/migrations/create_characters_table.sql`

