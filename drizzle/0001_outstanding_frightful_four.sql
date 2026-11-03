CREATE TABLE `agent_runs` (
	`owner` text NOT NULL,
	`workspace` text NOT NULL,
	`id` text NOT NULL,
	`action` text NOT NULL,
	`input_hash` text NOT NULL,
	`source` text NOT NULL,
	`output` text,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	PRIMARY KEY(`owner`, `workspace`, `id`)
);
