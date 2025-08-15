INSERT INTO public.agent_pricing
(id, agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, created_at, updated_at, updated_by, is_active, effective_from, effective_until, created_by)
VALUES(nextval('agent_pricing_id_seq'::regclass), ?, 500, 20000, 6.25, 15.00, now(), now(), ?, true, now(), '', ?);
INSERT INTO public.agent_pricing_history
(id, agent_id, pricing_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, change_type, changed_by, change_reason, created_at, effective_from, effective_until)
VALUES(nextval('agent_pricing_history_id_seq'::regclass), ?, 0, 0, 0, 0, 0, '', ?, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '');
INSERT INTO public.assignments
(id, project_id, assigned_by, assigned_to, project_numbers, assignment_type, created_at, updated_at)
VALUES(nextval('assignments_id_seq'::regclass), 0, ?, ?, '', 'worker_assignment'::character varying, now(), now());
INSERT INTO public.deadline_extension_requests
(id, project_id, worker_id, requested_deadline, reason, status, created_at, updated_at)
VALUES(0, 0, ?, '', '', 'pending'::extension_status, now(), now());
INSERT INTO public.financial_access_audit
(id, user_id, "user_role", access_type, resource_id, resource_type, success, error_message, ip_address, user_agent, created_at)
VALUES(nextval('financial_access_audit_id_seq'::regclass), ?, '', '', '', '', true, '', ?, '', now());
INSERT INTO public.hierarchy_change_log
(id, user_id, old_parent_id, new_parent_id, changed_by, change_reason, old_hierarchy_level, new_hierarchy_level, created_at)
VALUES(nextval('hierarchy_change_log_id_seq'::regclass), ?, ?, ?, ?, '', 0, 0, now());
INSERT INTO public.notification_history
(id, user_id, project_id, title, body, "delivery_status", retry_count, is_read, created_at, delivered_at, error_message, updated_at, sender_id, notification_type, hierarchy_level, target_roles, read_at)
VALUES(0, ?, 0, '', '', 'pending'::delivery_status, 0, false, now(), '', '', now(), ?, 'general'::character varying, 0, ?, '');
INSERT INTO public.notification_preferences
(id, user_id, notification_type, enabled, delivery_method, created_at, updated_at)
VALUES(nextval('notification_preferences_id_seq'::regclass), ?, '', true, 'database'::character varying, now(), now());
INSERT INTO public.notification_templates
(id, template_name, title_template, body_template, notification_type, target_roles, variables, created_at, updated_at)
VALUES(nextval('notification_templates_id_seq'::regclass), '', '', '', '', ?, '', now(), now());
INSERT INTO public.project_assignment_history
(id, project_id, assigned_to_id, assigned_to_role, assigned_by_id, assigned_by_role, assignment_type, previous_assigned_to_id, previous_assignment_type, assignment_reason, assignment_notes, hierarchy_level, assigned_at, effective_until, is_valid_hierarchy, validation_notes)
VALUES(nextval('project_assignment_history_id_seq'::regclass), 0, ?, '', ?, '', '', ?, '', '', '', 0, now(), '', true, '');
INSERT INTO public.project_change_requests
(id, project_id, instructions, created_at)
VALUES(0, 0, '', now());
INSERT INTO public.project_files
(id, project_id, uploader_id, file_name, file_path, purpose, uploaded_at)
VALUES(0, 0, ?, '', '', '', now());
INSERT INTO public.project_notes
(id, project_id, author_id, note, created_at)
VALUES(0, 0, ?, '', now());
INSERT INTO public.projects
(id, client_id, worker_id, agent_id, title, description, status, initial_word_count, adjusted_word_count, cost_gbp, deadline, order_reference, deadline_charge, "urgency_level", adjustment_type, created_at, updated_at, word_count, base_price, sub_worker_id, sub_agent_id, project_numbers, assignment_notes, assigned_at, assigned_by, pricing_type, base_price_gbp, urgency_charge_gbp, super_worker_fee_gbp, agent_fee_gbp, super_worker_id, subject, academic_level, paper_type)
VALUES(0, ?, ?, ?, '', '', 'pending_payment_approval'::project_status, 0, 0, 0, '', '', 0.00, 'normal'::urgency_level, '', now(), now(), 0, 0, ?, ?, ?, '', now(), ?, 'agent'::character varying, 0, 0, 0, 0, ?, '', '', '');
INSERT INTO public.reference_codes
(id, code, owner_id, code_type, is_active, created_at, updated_at)
VALUES(nextval('reference_codes_id_seq'::regclass), '', ?, '', true, now(), now());
INSERT INTO public.schema_migrations
(id, filename, executed_at)
VALUES(nextval('schema_migrations_id_seq'::regclass), '', now());
INSERT INTO public.super_agent_pricing
(id, word_range_start, word_range_end, price_gbp, created_at, updated_at)
VALUES(nextval('super_agent_pricing_id_seq'::regclass), 0, 0, 0, now(), now());
INSERT INTO public.user_earnings
(id, user_id, project_id, "role", earnings_gbp, earnings_inr, fees_paid_gbp, net_profit_gbp, calculation_date, created_at)
VALUES(nextval('user_earnings_id_seq'::regclass), ?, 0, '', 0, 0, 0, 0, now(), now());
INSERT INTO public.user_hierarchy
(id, user_id, parent_id, hierarchy_level, super_agent_id, created_at, updated_at)
VALUES(nextval('user_hierarchy_id_seq'::regclass), ?, ?, 0, ?, now(), now());
INSERT INTO public.user_sessions
(id, user_id, token_hash, expires_at, created_at, last_used_at, user_agent, ip_address)
VALUES(uuid_generate_v4(), ?, '', '', now(), now(), '', ?);
INSERT INTO public.users
(id, email, password_hash, full_name, avatar_url, "role", email_verified, created_at, updated_at, reference_code_used, recruited_by, super_agent_id)
VALUES(uuid_generate_v4(), '', '', '', '', 'client'::user_role, false, now(), now(), '', ?, ?);