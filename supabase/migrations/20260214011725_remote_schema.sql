


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_invite"("invite_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invite_record RECORD;
  current_user_id UUID := auth.uid();
BEGIN
  -- Busca o convite
  SELECT * INTO invite_record FROM household_invites
  WHERE token = invite_token AND status = 'pending' AND expires_at > now();

  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- Verifica se o email corresponde
  IF invite_record.email != (SELECT email FROM auth.users WHERE id = current_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite não é para você');
  END IF;

  -- Atualiza o profile para o novo household
  UPDATE profiles SET household_id = invite_record.household_id, role = 'member'
  WHERE id = current_user_id;

  -- Marca convite como aceito
  UPDATE household_invites SET status = 'accepted' WHERE id = invite_record.id;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."accept_invite"("invite_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_household_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_household_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_household_id UUID;
BEGIN
  INSERT INTO public.households (name) VALUES ('Meu Lar') RETURNING id INTO new_household_id;

  INSERT INTO public.profiles (id, email, full_name, household_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_household_id,
    'owner'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_household_member"("member_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  caller_profile RECORD;
  member_profile RECORD;
BEGIN
  -- Get caller info
  SELECT * INTO caller_profile FROM profiles WHERE id = auth.uid();
  IF caller_profile IS NULL OR caller_profile.role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o dono pode remover membros');
  END IF;

  -- Get member info
  SELECT * INTO member_profile FROM profiles WHERE id = member_id;
  IF member_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membro não encontrado');
  END IF;

  -- Can't remove yourself
  IF member_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode remover a si mesmo');
  END IF;

  -- Must be same household
  IF member_profile.household_id != caller_profile.household_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membro não pertence ao seu Lar');
  END IF;

  -- Create a new household for the removed member
  INSERT INTO households (name) VALUES ('Meu Lar');
  UPDATE profiles SET household_id = (SELECT id FROM households ORDER BY created_at DESC LIMIT 1), role = 'owner'
  WHERE id = member_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."remove_household_member"("member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_household_data"("target_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verify if the user triggering this is the owner of the household
  -- (This logic depends on how permissions are handled. Ideally RLS handles it, 
  -- but SECURITY DEFINER bypasses RLS. We must verify ownership here.)
  
  -- For now, we assume the caller application verifies PERMISSIONS via RLS on the 'households' table
  -- or we check if auth.uid() is the owner.
  
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND household_id = target_household_id 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas o dono do lar pode zerar os dados.';
  END IF;

  -- Delete Data
  DELETE FROM public.transactions WHERE household_id = target_household_id;
  DELETE FROM public.budgets WHERE household_id = target_household_id;
  DELETE FROM public.cards WHERE household_id = target_household_id;
  DELETE FROM public.accounts WHERE household_id = target_household_id;
  DELETE FROM public.categories WHERE household_id = target_household_id;
  DELETE FROM public.tags WHERE household_id = target_household_id;
  DELETE FROM public.household_invites WHERE household_id = target_household_id;
  
  -- We do NOT delete the household itself or the profiles, 
  -- just the financial data to "start over".
END;
$$;


ALTER FUNCTION "public"."reset_household_data"("target_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_household_categories"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.categories (household_id, name, icon, color, type) VALUES
    (NEW.id, 'Alimentação', 'utensils', '#10B981', 'expense'),
    (NEW.id, 'Transporte', 'car', '#3B82F6', 'expense'),
    (NEW.id, 'Moradia', 'home', '#8B5CF6', 'expense'),
    (NEW.id, 'Saúde', 'heart', '#EF4444', 'expense'),
    (NEW.id, 'Educação', 'book', '#06B6D4', 'expense'),
    (NEW.id, 'Lazer', 'gamepad', '#F59E0B', 'expense'),
    (NEW.id, 'Restaurantes', 'coffee', '#EC4899', 'expense'),
    (NEW.id, 'Vestuário', 'shirt', '#14B8A6', 'expense'),
    (NEW.id, 'Assinaturas', 'repeat', '#6366F1', 'expense'),
    (NEW.id, 'Outros', 'more-horizontal', '#64748B', 'expense');

  INSERT INTO public.categories (household_id, name, icon, color, type) VALUES
    (NEW.id, 'Salário', 'briefcase', '#10B981', 'income'),
    (NEW.id, 'Freelance', 'laptop', '#3B82F6', 'income'),
    (NEW.id, 'Investimentos', 'trending-up', '#F59E0B', 'income'),
    (NEW.id, 'Outros', 'more-horizontal', '#64748B', 'income');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_household_categories"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "balance" numeric(12,2) DEFAULT 0,
    "color" "text" DEFAULT '#10B981'::"text",
    "icon" "text" DEFAULT 'wallet'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "accounts_type_check" CHECK (("type" = ANY (ARRAY['checking'::"text", 'savings'::"text", 'wallet'::"text", 'investment'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "budgets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "last_four" "text",
    "brand" "text",
    "credit_limit" numeric(12,2),
    "closing_day" integer NOT NULL,
    "due_day" integer NOT NULL,
    "best_purchase_day" integer,
    "is_primary" boolean DEFAULT false,
    "color" "text" DEFAULT '#6366F1'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cards_best_purchase_day_check" CHECK ((("best_purchase_day" >= 1) AND ("best_purchase_day" <= 31))),
    CONSTRAINT "cards_brand_check" CHECK (("brand" = ANY (ARRAY['visa'::"text", 'mastercard'::"text", 'elo'::"text", 'amex'::"text", 'hipercard'::"text", 'other'::"text"]))),
    CONSTRAINT "cards_closing_day_check" CHECK ((("closing_day" >= 1) AND ("closing_day" <= 31))),
    CONSTRAINT "cards_due_day_check" CHECK ((("due_day" >= 1) AND ("due_day" <= 31)))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT 'tag'::"text",
    "color" "text" DEFAULT '#F59E0B'::"text",
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    CONSTRAINT "household_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."household_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Meu Lar'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."households" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "household_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#8B5CF6'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_tags" (
    "transaction_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."transaction_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "card_id" "uuid",
    "category_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "description" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_recurring" boolean DEFAULT false,
    "recurrence_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_recurrence_type_check" CHECK (("recurrence_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_month_year_key" UNIQUE ("category_id", "month", "year");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_household_id_name_type_key" UNIQUE ("household_id", "name", "type");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_invites"
    ADD CONSTRAINT "household_invites_household_id_email_key" UNIQUE ("household_id", "email");



ALTER TABLE ONLY "public"."household_invites"
    ADD CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_household_id_name_key" UNIQUE ("household_id", "name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transaction_id", "tag_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "on_household_created" AFTER INSERT ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."seed_household_categories"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_invites"
    ADD CONSTRAINT "household_invites_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_invites"
    ADD CONSTRAINT "household_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_delete" ON "public"."accounts" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "accounts_insert" ON "public"."accounts" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "accounts_select" ON "public"."accounts" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "accounts_update" ON "public"."accounts" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budgets_delete" ON "public"."budgets" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "budgets_insert" ON "public"."budgets" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "budgets_select" ON "public"."budgets" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "budgets_update" ON "public"."budgets" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cards_delete" ON "public"."cards" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "cards_insert" ON "public"."cards" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "cards_select" ON "public"."cards" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "cards_update" ON "public"."cards" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete" ON "public"."categories" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "categories_insert" ON "public"."categories" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));



ALTER TABLE "public"."household_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "households_select_own" ON "public"."households" FOR SELECT USING (("id" = "public"."get_user_household_id"()));



CREATE POLICY "households_update_own" ON "public"."households" FOR UPDATE USING (("id" = "public"."get_user_household_id"()));



CREATE POLICY "invites_delete" ON "public"."household_invites" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "invites_insert" ON "public"."household_invites" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "invites_select" ON "public"."household_invites" FOR SELECT USING ((("household_id" = "public"."get_user_household_id"()) OR ("email" = "public"."get_user_email"())));



CREATE POLICY "invites_update" ON "public"."household_invites" FOR UPDATE USING ((("household_id" = "public"."get_user_household_id"()) OR ("email" = "public"."get_user_email"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("household_id" = "public"."get_user_household_id"())));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_delete" ON "public"."tags" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "tags_insert" ON "public"."tags" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "tags_select" ON "public"."tags" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "tags_update" ON "public"."tags" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));



ALTER TABLE "public"."transaction_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transaction_tags_delete" ON "public"."transaction_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_tags"."transaction_id") AND ("t"."household_id" = "public"."get_user_household_id"())))));



CREATE POLICY "transaction_tags_insert" ON "public"."transaction_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_tags"."transaction_id") AND ("t"."household_id" = "public"."get_user_household_id"())))));



CREATE POLICY "transaction_tags_select" ON "public"."transaction_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_tags"."transaction_id") AND ("t"."household_id" = "public"."get_user_household_id"())))));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_delete" ON "public"."transactions" FOR DELETE USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT WITH CHECK (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING (("household_id" = "public"."get_user_household_id"()));



CREATE POLICY "transactions_update" ON "public"."transactions" FOR UPDATE USING (("household_id" = "public"."get_user_household_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."accept_invite"("invite_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite"("invite_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite"("invite_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_household_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_household_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_household_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_household_member"("member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_household_member"("member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_household_member"("member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_household_data"("target_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_household_data"("target_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_household_data"("target_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_household_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_household_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_household_categories"() TO "service_role";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."household_invites" TO "anon";
GRANT ALL ON TABLE "public"."household_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."household_invites" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_tags" TO "anon";
GRANT ALL ON TABLE "public"."transaction_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_tags" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


