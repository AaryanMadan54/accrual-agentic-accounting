CREATE TABLE `workspace_revisions` (
	`owner` text NOT NULL,
	`workspace` text NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `workspace`, `revision`)
);
