-- Fix notification_history table if it doesn't exist
-- Run this in your Supabase SQL editor

-- Create notification_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_history (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    user_id uuid NOT NULL,
    project_id bigint,
    title character varying NOT NULL,
    body text NOT NULL,
    delivery_status text DEFAULT 'pending'::text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    error_message text,
    CONSTRAINT notification_history_pkey PRIMARY KEY (id),
    CONSTRAINT notification_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT notification_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Create push_subscriptions table if it doesn't exist (for future use)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    user_id uuid NOT NULL,
    subscription jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON public.notification_history(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON public.notification_history(delivery_status);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Grant necessary permissions
GRANT ALL ON public.notification_history TO authenticated;
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT USAGE ON SEQUENCE notification_history_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE push_subscriptions_id_seq TO authenticated;