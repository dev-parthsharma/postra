<!-- SCHEMA MAP -->

1) current_trends
- id              : uuid
- trend           : text
- niche           : text
- score           : numeric
- expires_at      : timestamptz
- created_at      : timestamptz

2) instagram_connections
- id                  : uuid
- user_id             : uuid
- instagram_user_id   : varchar
- instagram_username  : varchar
- access_token        : text
- token_expires_at    : timestamptz
- created_at          : timestamptz
- updated_at          : timestamptz

JOIN:
- instagram_connections.user_id -> user_profile.id

3) messages
- id          : uuid
- chat_id     : uuid
- sequence    : int4
- content     : text
- source      : text
- type        : text
- metadata    : jsonb
- created_at  : timestamptz

JOIN:
- messages.chat_id -> chats.id

4) user_profile
- id                  : uuid
- name                : text
- niche               : text
- tone                : text
- style               : text
- goal                : text
- plan                : text
- preferred_language  : text
- niche_changed_at    : timestamptz
- created_at          : timestamptz
- updated_at          : timestamptz
- is_onboarded        : bool
- ideas_used_today    : int2
- last_reset_date     : date

JOIN:
- user_profile.id -> auth.users.id

5) user_stats
- id           : uuid
- user_id      : uuid
- stat_date    : date
- posts_count  : int4
- is_break     : bool
- streak_count : int4
- created_at   : timestamptz
- updated_at   : timestamptz

JOIN:
- user_stats.user_id -> user_profile.id

6) media
- id           : uuid
- user_id      : uuid
- file_url     : text
- type         : varchar(10)
- file_size    : int4
- created_at   : timestamptz

JOIN:
- media.user_id -> user_profile.id

7) posts
- id           : uuid
- chat_id      : uuid
- idea_id      : uuid
- hook         : text
- script       : text
- guide        : text
- caption      : text
- hashtags     : jsonb
- cover_image  : text
- status       : text
- created_at   : timestamptz
- updated_at   : timestamptz
- user_id      : uuid
- posted_at    : timestamptz

JOINS:
- posts.chat_id -> chats.id
- posts.user_id -> user_profile.id
- posts.idea_id -> ideas.id

8) post_media
- id           : uuid
- post_id      : uuid
- media_id     : uuid
- created_at   : timestamptz

JOINS:
- post_media.post_id -> posts.id
- post_media.media_id -> media.id

9) chats
- id          : uuid
- idea_id     : uuid
- title       : text
- created_at  : timestamptz
- updated_at  : timestamptz
- user_id     : uuid

JOINS:
- chats.user_id -> user_profile.id
- chats.idea_id -> ideas.id

10) schedules
- id            : uuid
- post_id       : uuid
- scheduled_at  : timestamptz
- status        : text
- created_at    : timestamptz

JOIN:
- schedules.post_id -> posts.id

11) ideal_timing
- id             : uuid
- user_id        : uuid
- niche          : text
- time_monday    : time
- time_tuesday   : time
- time_wednesday : time
- time_thursday  : time
- time_friday    : time
- time_saturday  : time
- time_sunday    : time
- created_at     : timestamptz
- updated_at     : timestamptz

JOIN:
- ideal_timing.user_id -> user_profile.id

12) plans
- id            : uuid
- name          : text
- price_monthly : numeric
- price_yearly  : numeric
- limits        : jsonb
- features      : jsonb
- is_active     : bool
- created_at    : timestamptz
- updated_at    : timestamptz

13) ideas
- id            : uuid
- user_id       : uuid
- idea          : text
- source        : text
- is_favourite  : bool
- created_at    : timestamptz
- updated_at    : timestamptz
- why_it_works  : text
- win_score     : int2
- trend_match   : text
- trend_id      : uuid

JOIN:
- ideas.user_id -> user_profile.id
- ideas.trend_id -> current_trends.id


<!-- RELATIONSHIPS -->

user_profile.id -> auth.users.id  
messages.chat_id -> chats.id  
posts.chat_id -> chats.id  
posts.user_id -> user_profile.id  
posts.idea_id -> ideas.id  
schedules.post_id -> posts.id  
chats.user_id -> user_profile.id  
chats.idea_id -> ideas.id  
ideal_timing.user_id -> user_profile.id  
ideas.user_id -> user_profile.id  
instagram_connections.user_id -> user_profile.id  
user_stats.user_id -> user_profile.id  
media.user_id -> user_profile.id  
post_media.post_id -> posts.id  
post_media.media_id -> media.id  