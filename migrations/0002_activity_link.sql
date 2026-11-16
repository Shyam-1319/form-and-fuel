CREATE UNIQUE INDEX one_link_per_activity ON records(user_id,json_extract(data,'$.activityId')) WHERE kind='session' AND json_extract(data,'$.activityId') IS NOT NULL;
