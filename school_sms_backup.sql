--
-- PostgreSQL database dump
--

\restrict pks7KcdNJlalNhYzO6ovhleLZUZhiv1SOLpc5b1hTKC0fymrDHJwX2Dy2bZhZHd

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

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

--
-- Name: auditoperationenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.auditoperationenum AS ENUM (
    'bulk_promote',
    'undo_promote',
    'new_year',
    'activate_year',
    'close_year',
    'lock_marks',
    'issue_tc',
    'clone_subjects',
    'clone_fees',
    'student_activation_started',
    'student_activation_verified',
    'student_activation_completed',
    'student_activation_failed'
);


ALTER TYPE public.auditoperationenum OWNER TO sms_user;

--
-- Name: calendareventtypeenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.calendareventtypeenum AS ENUM (
    'holiday',
    'exam_period',
    'term_start',
    'term_end',
    'event'
);


ALTER TYPE public.calendareventtypeenum OWNER TO sms_user;

--
-- Name: dataauditactionenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.dataauditactionenum AS ENUM (
    'create',
    'update',
    'delete'
);


ALTER TYPE public.dataauditactionenum OWNER TO sms_user;

--
-- Name: enrollmentstatusenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.enrollmentstatusenum AS ENUM (
    'active',
    'retained',
    'graduated',
    'transferred',
    'dropped',
    'provisional',
    'on_hold'
);


ALTER TYPE public.enrollmentstatusenum OWNER TO sms_user;

--
-- Name: genderenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.genderenum AS ENUM (
    'M',
    'F',
    'Other'
);


ALTER TYPE public.genderenum OWNER TO sms_user;

--
-- Name: importstatusenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.importstatusenum AS ENUM (
    'completed',
    'rolled_back'
);


ALTER TYPE public.importstatusenum OWNER TO sms_user;

--
-- Name: studentstatusenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.studentstatusenum AS ENUM (
    'Active',
    'TC_Issued',
    'Left',
    'Passed_Out',
    'Alumni',
    'On_Hold',
    'Detained',
    'Provisional'
);


ALTER TYPE public.studentstatusenum OWNER TO sms_user;

--
-- Name: yearsstatusenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.yearsstatusenum AS ENUM (
    'draft',
    'active',
    'closed'
);


ALTER TYPE public.yearsstatusenum OWNER TO sms_user;

--
-- Name: yearstatusenum; Type: TYPE; Schema: public; Owner: sms_user
--

CREATE TYPE public.yearstatusenum AS ENUM (
    'draft',
    'active',
    'closed'
);


ALTER TYPE public.yearstatusenum OWNER TO sms_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_calendar; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.academic_calendar (
    id integer NOT NULL,
    academic_year_id integer NOT NULL,
    event_type character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    description text,
    affects_attendance boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.academic_calendar OWNER TO sms_user;

--
-- Name: academic_calendar_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.academic_calendar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.academic_calendar_id_seq OWNER TO sms_user;

--
-- Name: academic_calendar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.academic_calendar_id_seq OWNED BY public.academic_calendar.id;


--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.academic_years (
    id integer NOT NULL,
    label character varying(10) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean,
    status public.yearsstatusenum DEFAULT 'active'::public.yearsstatusenum NOT NULL,
    is_upcoming boolean DEFAULT false NOT NULL,
    branch_id integer
);


ALTER TABLE public.academic_years OWNER TO sms_user;

--
-- Name: academic_years_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.academic_years_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.academic_years_id_seq OWNER TO sms_user;

--
-- Name: academic_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.academic_years_id_seq OWNED BY public.academic_years.id;


--
-- Name: admin_login_otp_challenges; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.admin_login_otp_challenges (
    id integer NOT NULL,
    challenge_id character varying(36) NOT NULL,
    user_id integer NOT NULL,
    channel character varying(20) NOT NULL,
    destination character varying(255) NOT NULL,
    otp_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    attempt_count integer NOT NULL,
    max_attempts integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_login_otp_challenges OWNER TO sms_user;

--
-- Name: admin_login_otp_challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.admin_login_otp_challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_login_otp_challenges_id_seq OWNER TO sms_user;

--
-- Name: admin_login_otp_challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.admin_login_otp_challenges_id_seq OWNED BY public.admin_login_otp_challenges.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO sms_user;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    student_id integer,
    class_id integer,
    date date NOT NULL,
    status character varying(5) NOT NULL,
    enrollment_id integer
);


ALTER TABLE public.attendance OWNER TO sms_user;

--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attendance_id_seq OWNER TO sms_user;

--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    operation public.auditoperationenum NOT NULL,
    performed_by integer,
    academic_year_id integer,
    class_id integer,
    affected_count integer,
    payload text,
    result character varying(20) DEFAULT 'success'::character varying NOT NULL,
    error_detail text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO sms_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO sms_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: auth_refresh_sessions; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.auth_refresh_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(128) NOT NULL,
    family_id character varying(36) NOT NULL,
    replaced_by_session_id integer,
    user_agent character varying(255),
    ip_address character varying(64),
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone
);


ALTER TABLE public.auth_refresh_sessions OWNER TO sms_user;

--
-- Name: auth_refresh_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.auth_refresh_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.auth_refresh_sessions_id_seq OWNER TO sms_user;

--
-- Name: auth_refresh_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.auth_refresh_sessions_id_seq OWNED BY public.auth_refresh_sessions.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    gseb_affiliation_no text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.branches OWNER TO sms_user;

--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.branches_id_seq OWNER TO sms_user;

--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    division character varying(5),
    academic_year_id integer,
    capacity integer,
    medium character varying(20) DEFAULT 'English'::character varying,
    promotion_status character varying(20) DEFAULT 'not_started'::character varying NOT NULL,
    branch_id integer
);


ALTER TABLE public.classes OWNER TO sms_user;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.classes_id_seq OWNER TO sms_user;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: data_audit_logs; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.data_audit_logs (
    id integer NOT NULL,
    user_id integer,
    action public.dataauditactionenum NOT NULL,
    table_name character varying(120) NOT NULL,
    record_id character varying(64) NOT NULL,
    old_value json,
    new_value json,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.data_audit_logs OWNER TO sms_user;

--
-- Name: data_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.data_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.data_audit_logs_id_seq OWNER TO sms_user;

--
-- Name: data_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.data_audit_logs_id_seq OWNED BY public.data_audit_logs.id;


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.enrollments (
    id integer NOT NULL,
    student_id integer NOT NULL,
    academic_year_id integer NOT NULL,
    class_id integer NOT NULL,
    roll_number character varying(30),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    promotion_action character varying(20),
    promotion_status character varying(20) DEFAULT 'not_started'::character varying NOT NULL,
    enrolled_on date DEFAULT CURRENT_DATE NOT NULL,
    reason_for_leaving text,
    created_at timestamp with time zone DEFAULT now(),
    original_roll_number character varying(30)
);


ALTER TABLE public.enrollments OWNER TO sms_user;

--
-- Name: enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.enrollments_id_seq OWNER TO sms_user;

--
-- Name: enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.enrollments_id_seq OWNED BY public.enrollments.id;


--
-- Name: exam_subject_configs; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.exam_subject_configs (
    id integer NOT NULL,
    exam_id integer NOT NULL,
    subject_id integer NOT NULL,
    max_theory integer NOT NULL,
    max_practical integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.exam_subject_configs OWNER TO sms_user;

--
-- Name: exam_subject_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.exam_subject_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.exam_subject_configs_id_seq OWNER TO sms_user;

--
-- Name: exam_subject_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.exam_subject_configs_id_seq OWNED BY public.exam_subject_configs.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    class_id integer,
    exam_date date,
    academic_year_id integer,
    weightage numeric(5,2)
);


ALTER TABLE public.exams OWNER TO sms_user;

--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.exams_id_seq OWNER TO sms_user;

--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: fee_heads; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.fee_heads (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    frequency character varying(20) NOT NULL,
    description text,
    is_active boolean
);


ALTER TABLE public.fee_heads OWNER TO sms_user;

--
-- Name: fee_heads_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.fee_heads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.fee_heads_id_seq OWNER TO sms_user;

--
-- Name: fee_heads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.fee_heads_id_seq OWNED BY public.fee_heads.id;


--
-- Name: fee_payments; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.fee_payments (
    id integer NOT NULL,
    student_fee_id integer,
    amount_paid numeric(10,2) NOT NULL,
    payment_date date NOT NULL,
    mode character varying(20) NOT NULL,
    receipt_number character varying(30),
    collected_by character varying(100),
    online_order_id integer,
    notes text
);


ALTER TABLE public.fee_payments OWNER TO sms_user;

--
-- Name: fee_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.fee_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.fee_payments_id_seq OWNER TO sms_user;

--
-- Name: fee_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.fee_payments_id_seq OWNED BY public.fee_payments.id;


--
-- Name: fee_structures; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.fee_structures (
    id integer NOT NULL,
    class_id integer,
    fee_head_id integer,
    amount numeric(10,2) NOT NULL,
    due_date date,
    academic_year_id integer
);


ALTER TABLE public.fee_structures OWNER TO sms_user;

--
-- Name: fee_structures_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.fee_structures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.fee_structures_id_seq OWNER TO sms_user;

--
-- Name: fee_structures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.fee_structures_id_seq OWNED BY public.fee_structures.id;


--
-- Name: import_batch_items; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.import_batch_items (
    id integer NOT NULL,
    import_batch_id integer NOT NULL,
    entity_type character varying(32) NOT NULL,
    entity_id integer,
    action character varying(32) NOT NULL,
    payload json,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.import_batch_items OWNER TO sms_user;

--
-- Name: import_batch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.import_batch_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.import_batch_items_id_seq OWNER TO sms_user;

--
-- Name: import_batch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.import_batch_items_id_seq OWNED BY public.import_batch_items.id;


--
-- Name: import_batches; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.import_batches (
    id integer NOT NULL,
    entity_type character varying(32) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_format character varying(16) NOT NULL,
    merge_mode character varying(32) DEFAULT 'skip_duplicates'::character varying NOT NULL,
    status character varying(32) DEFAULT 'completed'::character varying NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    imported_rows integer DEFAULT 0 NOT NULL,
    skipped_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    summary json,
    rollback_summary json,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now(),
    rolled_back_at timestamp with time zone
);


ALTER TABLE public.import_batches OWNER TO sms_user;

--
-- Name: import_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.import_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.import_batches_id_seq OWNER TO sms_user;

--
-- Name: import_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.import_batches_id_seq OWNED BY public.import_batches.id;


--
-- Name: marks; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.marks (
    id integer NOT NULL,
    student_id integer,
    subject_id integer,
    exam_id integer,
    theory_marks numeric(5,2),
    practical_marks numeric(5,2),
    is_absent boolean,
    locked_at timestamp with time zone,
    enrollment_id integer
);


ALTER TABLE public.marks OWNER TO sms_user;

--
-- Name: marks_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.marks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.marks_id_seq OWNER TO sms_user;

--
-- Name: marks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.marks_id_seq OWNED BY public.marks.id;


--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.notification_log (
    id integer NOT NULL,
    student_id integer,
    notification_type character varying(40) NOT NULL,
    channel character varying(20) NOT NULL,
    recipient_phone character varying(20) NOT NULL,
    template_name character varying(100),
    message_preview text,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    error_message text,
    idempotency_key character varying(160),
    outbox_id integer,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notification_log OWNER TO sms_user;

--
-- Name: notification_log_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.notification_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_log_id_seq OWNER TO sms_user;

--
-- Name: notification_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.notification_log_id_seq OWNED BY public.notification_log.id;


--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.notification_outbox (
    id integer NOT NULL,
    provider character varying(20) NOT NULL,
    destination character varying(255) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    payload json,
    status character varying(20) NOT NULL,
    attempts integer NOT NULL,
    max_attempts integer NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notification_outbox OWNER TO sms_user;

--
-- Name: notification_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.notification_outbox_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_outbox_id_seq OWNER TO sms_user;

--
-- Name: notification_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.notification_outbox_id_seq OWNED BY public.notification_outbox.id;


--
-- Name: online_payment_orders; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.online_payment_orders (
    id integer NOT NULL,
    student_fee_id integer,
    razorpay_order_id text NOT NULL,
    razorpay_payment_id text,
    razorpay_signature text,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying NOT NULL,
    status character varying(20) DEFAULT 'created'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    failure_reason text,
    student_id integer,
    scope character varying(30) NOT NULL,
    payment_option character varying(20),
    CONSTRAINT online_payment_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'paid'::character varying, 'failed'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.online_payment_orders OWNER TO sms_user;

--
-- Name: online_payment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.online_payment_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.online_payment_orders_id_seq OWNER TO sms_user;

--
-- Name: online_payment_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.online_payment_orders_id_seq OWNED BY public.online_payment_orders.id;


--
-- Name: operation_jobs; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.operation_jobs (
    id integer NOT NULL,
    job_type character varying(80) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    actor_user_id integer,
    payload json,
    progress integer DEFAULT 0 NOT NULL,
    result json,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


ALTER TABLE public.operation_jobs OWNER TO sms_user;

--
-- Name: operation_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.operation_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.operation_jobs_id_seq OWNER TO sms_user;

--
-- Name: operation_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.operation_jobs_id_seq OWNED BY public.operation_jobs.id;


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.otp_verifications (
    id integer NOT NULL,
    activation_request_id integer NOT NULL,
    provider character varying(20) NOT NULL,
    destination_fingerprint character varying(64) NOT NULL,
    otp_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    attempt_count integer NOT NULL,
    max_attempts integer NOT NULL,
    resend_available_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.otp_verifications OWNER TO sms_user;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.otp_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.otp_verifications_id_seq OWNER TO sms_user;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.otp_verifications_id_seq OWNED BY public.otp_verifications.id;


--
-- Name: portal_activation_invites; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.portal_activation_invites (
    id integer NOT NULL,
    invite_id character varying(36) NOT NULL,
    token_hash character varying(128) NOT NULL,
    student_id integer NOT NULL,
    account_type character varying(20) NOT NULL,
    destination character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_by_user_id integer,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.portal_activation_invites OWNER TO sms_user;

--
-- Name: portal_activation_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.portal_activation_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.portal_activation_invites_id_seq OWNER TO sms_user;

--
-- Name: portal_activation_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.portal_activation_invites_id_seq OWNED BY public.portal_activation_invites.id;


--
-- Name: profile_correction_requests; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.profile_correction_requests (
    id integer NOT NULL,
    student_id integer NOT NULL,
    requested_by_user_id integer NOT NULL,
    field_name character varying(80) NOT NULL,
    current_value text,
    requested_value text NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    resolved_by_user_id integer,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.profile_correction_requests OWNER TO sms_user;

--
-- Name: profile_correction_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.profile_correction_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.profile_correction_requests_id_seq OWNER TO sms_user;

--
-- Name: profile_correction_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.profile_correction_requests_id_seq OWNED BY public.profile_correction_requests.id;


--
-- Name: receipt_number_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.receipt_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.receipt_number_seq OWNER TO sms_user;

--
-- Name: report_cards; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.report_cards (
    id integer NOT NULL,
    enrollment_id integer NOT NULL,
    exam_id integer,
    pdf_path character varying(500),
    is_locked boolean DEFAULT false NOT NULL,
    generated_at timestamp with time zone DEFAULT now(),
    locked_at timestamp with time zone
);


ALTER TABLE public.report_cards OWNER TO sms_user;

--
-- Name: report_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.report_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.report_cards_id_seq OWNER TO sms_user;

--
-- Name: report_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.report_cards_id_seq OWNED BY public.report_cards.id;


--
-- Name: student_activation_requests; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.student_activation_requests (
    id integer NOT NULL,
    activation_id character varying(36) NOT NULL,
    student_id integer NOT NULL,
    account_type character varying(20) NOT NULL,
    destination character varying(255) NOT NULL,
    destination_fingerprint character varying(64) NOT NULL,
    status character varying(20) NOT NULL,
    verified_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    resend_count integer NOT NULL,
    locked_until timestamp with time zone,
    request_ip character varying(64),
    user_agent character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.student_activation_requests OWNER TO sms_user;

--
-- Name: student_activation_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.student_activation_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.student_activation_requests_id_seq OWNER TO sms_user;

--
-- Name: student_activation_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.student_activation_requests_id_seq OWNED BY public.student_activation_requests.id;


--
-- Name: student_fees; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.student_fees (
    id integer NOT NULL,
    student_id integer,
    fee_structure_id integer,
    concession numeric(10,2),
    net_amount numeric(10,2) NOT NULL,
    academic_year_id integer,
    invoice_type character varying(10) DEFAULT 'regular'::character varying NOT NULL,
    source_invoice_id integer,
    enrollment_id integer
);


ALTER TABLE public.student_fees OWNER TO sms_user;

--
-- Name: student_fees_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.student_fees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.student_fees_id_seq OWNER TO sms_user;

--
-- Name: student_fees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.student_fees_id_seq OWNED BY public.student_fees.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.students (
    id integer NOT NULL,
    student_id character varying(20) NOT NULL,
    gr_number character varying(20),
    name_en character varying(100) NOT NULL,
    name_gu character varying(100) NOT NULL,
    dob date NOT NULL,
    gender public.genderenum NOT NULL,
    class_id integer,
    roll_number integer,
    father_name character varying(100) NOT NULL,
    mother_name character varying(100),
    contact character varying(20) NOT NULL,
    address text,
    category character varying(10),
    aadhar_last4 character varying(4),
    admission_date date NOT NULL,
    academic_year_id integer NOT NULL,
    status public.studentstatusenum,
    photo_path character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    student_user_id integer,
    parent_user_id integer,
    reason_for_leaving text,
    previous_school text,
    student_email character varying(100),
    student_phone character varying(20),
    guardian_email character varying(100),
    guardian_phone character varying(20),
    branch_id integer
);


ALTER TABLE public.students OWNER TO sms_user;

--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.students_id_seq OWNER TO sms_user;

--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    class_id integer,
    max_theory integer,
    max_practical integer,
    subject_type character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    code character varying(20),
    is_exam_eligible boolean DEFAULT true NOT NULL,
    passing_marks integer
);


ALTER TABLE public.subjects OWNER TO sms_user;

--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.subjects_id_seq OWNER TO sms_user;

--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: tc_number_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.tc_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tc_number_seq OWNER TO sms_user;

--
-- Name: teacher_class_assignments; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.teacher_class_assignments (
    id integer NOT NULL,
    teacher_id integer NOT NULL,
    class_id integer NOT NULL,
    academic_year_id integer NOT NULL,
    subject_id integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.teacher_class_assignments OWNER TO sms_user;

--
-- Name: teacher_class_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.teacher_class_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.teacher_class_assignments_id_seq OWNER TO sms_user;

--
-- Name: teacher_class_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.teacher_class_assignments_id_seq OWNED BY public.teacher_class_assignments.id;


--
-- Name: token_blocklist; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.token_blocklist (
    id integer NOT NULL,
    jti character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.token_blocklist OWNER TO sms_user;

--
-- Name: token_blocklist_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.token_blocklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.token_blocklist_id_seq OWNER TO sms_user;

--
-- Name: token_blocklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.token_blocklist_id_seq OWNED BY public.token_blocklist.id;


--
-- Name: transfer_certificates; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.transfer_certificates (
    id integer NOT NULL,
    tc_number character varying(30) NOT NULL,
    student_id integer NOT NULL,
    reason text,
    conduct character varying(100),
    issued_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.transfer_certificates OWNER TO sms_user;

--
-- Name: transfer_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.transfer_certificates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transfer_certificates_id_seq OWNER TO sms_user;

--
-- Name: transfer_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.transfer_certificates_id_seq OWNED BY public.transfer_certificates.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20),
    is_active boolean,
    branch_id integer,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_channel character varying(20),
    two_factor_destination character varying(255),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'student'::character varying, 'parent'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO sms_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sms_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO sms_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sms_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: academic_calendar id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_calendar ALTER COLUMN id SET DEFAULT nextval('public.academic_calendar_id_seq'::regclass);


--
-- Name: academic_years id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_years ALTER COLUMN id SET DEFAULT nextval('public.academic_years_id_seq'::regclass);


--
-- Name: admin_login_otp_challenges id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.admin_login_otp_challenges ALTER COLUMN id SET DEFAULT nextval('public.admin_login_otp_challenges_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: auth_refresh_sessions id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.auth_refresh_sessions ALTER COLUMN id SET DEFAULT nextval('public.auth_refresh_sessions_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: data_audit_logs id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.data_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.data_audit_logs_id_seq'::regclass);


--
-- Name: enrollments id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN id SET DEFAULT nextval('public.enrollments_id_seq'::regclass);


--
-- Name: exam_subject_configs id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exam_subject_configs ALTER COLUMN id SET DEFAULT nextval('public.exam_subject_configs_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: fee_heads id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_heads ALTER COLUMN id SET DEFAULT nextval('public.fee_heads_id_seq'::regclass);


--
-- Name: fee_payments id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_payments ALTER COLUMN id SET DEFAULT nextval('public.fee_payments_id_seq'::regclass);


--
-- Name: fee_structures id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures ALTER COLUMN id SET DEFAULT nextval('public.fee_structures_id_seq'::regclass);


--
-- Name: import_batch_items id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batch_items ALTER COLUMN id SET DEFAULT nextval('public.import_batch_items_id_seq'::regclass);


--
-- Name: import_batches id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batches ALTER COLUMN id SET DEFAULT nextval('public.import_batches_id_seq'::regclass);


--
-- Name: marks id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks ALTER COLUMN id SET DEFAULT nextval('public.marks_id_seq'::regclass);


--
-- Name: notification_log id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_log ALTER COLUMN id SET DEFAULT nextval('public.notification_log_id_seq'::regclass);


--
-- Name: notification_outbox id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_outbox ALTER COLUMN id SET DEFAULT nextval('public.notification_outbox_id_seq'::regclass);


--
-- Name: online_payment_orders id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.online_payment_orders ALTER COLUMN id SET DEFAULT nextval('public.online_payment_orders_id_seq'::regclass);


--
-- Name: operation_jobs id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.operation_jobs ALTER COLUMN id SET DEFAULT nextval('public.operation_jobs_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


--
-- Name: portal_activation_invites id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites ALTER COLUMN id SET DEFAULT nextval('public.portal_activation_invites_id_seq'::regclass);


--
-- Name: profile_correction_requests id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.profile_correction_requests ALTER COLUMN id SET DEFAULT nextval('public.profile_correction_requests_id_seq'::regclass);


--
-- Name: report_cards id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.report_cards ALTER COLUMN id SET DEFAULT nextval('public.report_cards_id_seq'::regclass);


--
-- Name: student_activation_requests id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_activation_requests ALTER COLUMN id SET DEFAULT nextval('public.student_activation_requests_id_seq'::regclass);


--
-- Name: student_fees id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees ALTER COLUMN id SET DEFAULT nextval('public.student_fees_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: teacher_class_assignments id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments ALTER COLUMN id SET DEFAULT nextval('public.teacher_class_assignments_id_seq'::regclass);


--
-- Name: token_blocklist id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.token_blocklist ALTER COLUMN id SET DEFAULT nextval('public.token_blocklist_id_seq'::regclass);


--
-- Name: transfer_certificates id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.transfer_certificates ALTER COLUMN id SET DEFAULT nextval('public.transfer_certificates_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: academic_calendar; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.academic_calendar (id, academic_year_id, event_type, title, start_date, end_date, description, affects_attendance, created_at) FROM stdin;
1	1	holiday	diwali	2025-10-05	2025-12-05		t	2026-05-19 02:50:43.631237+00
\.


--
-- Data for Name: academic_years; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.academic_years (id, label, start_date, end_date, is_current, status, is_upcoming, branch_id) FROM stdin;
1	2025-26	2025-06-01	2026-04-30	t	active	f	\N
2	2026-27	2026-06-01	2027-04-30	f	draft	t	\N
\.


--
-- Data for Name: admin_login_otp_challenges; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.admin_login_otp_challenges (id, challenge_id, user_id, channel, destination, otp_hash, expires_at, verified_at, attempt_count, max_attempts, created_at) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.alembic_version (version_num) FROM stdin;
o7p8q9r0s1t2
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.attendance (id, student_id, class_id, date, status, enrollment_id) FROM stdin;
1	1	2	2026-05-03	P	\N
2	2	2	2026-05-03	P	\N
3	3	2	2026-05-03	P	\N
4	4	1	2026-05-03	P	\N
5	5	3	2026-05-03	A	\N
6	1	2	2026-05-04	P	\N
7	2	2	2026-05-04	P	\N
8	3	2	2026-05-04	P	\N
9	4	1	2026-05-04	A	\N
10	5	3	2026-05-04	P	\N
11	1	2	2026-05-05	P	\N
12	2	2	2026-05-05	A	\N
13	3	2	2026-05-05	P	\N
14	4	1	2026-05-05	P	\N
15	5	3	2026-05-05	P	\N
16	1	2	2026-05-06	P	\N
17	2	2	2026-05-06	P	\N
18	3	2	2026-05-06	L	\N
19	4	1	2026-05-06	P	\N
20	5	3	2026-05-06	A	\N
21	1	2	2026-05-07	P	\N
22	2	2	2026-05-07	P	\N
23	3	2	2026-05-07	P	\N
24	4	1	2026-05-07	P	\N
25	5	3	2026-05-07	P	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.audit_logs (id, operation, performed_by, academic_year_id, class_id, affected_count, payload, result, error_detail, created_at) FROM stdin;
1	student_activation_started	\N	\N	\N	1	{"account_type": "student", "activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822"}	success	\N	2026-05-07 08:11:06.604552+00
2	student_activation_started	\N	\N	\N	1	{"account_type": "student", "activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822"}	success	\N	2026-05-07 08:16:53.47175+00
3	student_activation_verified	\N	\N	\N	1	{"account_type": "student", "activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822"}	success	\N	2026-05-07 08:17:38.687719+00
4	student_activation_completed	\N	\N	\N	1	{"account_type": "student", "activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822", "user_id": 6}	success	\N	2026-05-07 08:17:50.237558+00
5	student_activation_started	\N	\N	\N	1	{"account_type": "parent", "activation_id": "05b62c63-5cba-425a-946b-6dff12c5270d"}	success	\N	2026-05-07 08:21:43.380392+00
6	student_activation_verified	\N	\N	\N	1	{"account_type": "parent", "activation_id": "05b62c63-5cba-425a-946b-6dff12c5270d"}	success	\N	2026-05-07 08:22:13.008065+00
7	student_activation_started	\N	\N	\N	1	{"account_type": "parent", "activation_id": "9b2dfdc1-3e3a-4ece-a558-e5a932fdbf89"}	success	\N	2026-05-07 08:25:54.835804+00
8	student_activation_verified	\N	\N	\N	1	{"account_type": "parent", "activation_id": "9b2dfdc1-3e3a-4ece-a558-e5a932fdbf89"}	success	\N	2026-05-07 08:29:12.255807+00
9	student_activation_completed	\N	\N	\N	1	{"account_type": "parent", "activation_id": "9b2dfdc1-3e3a-4ece-a558-e5a932fdbf89", "user_id": 7}	success	\N	2026-05-07 08:29:22.361508+00
10	student_activation_started	\N	\N	\N	1	{"account_type": "student", "activation_id": "2b9f9faf-0ac8-48c3-a876-f519ee3207e0"}	success	\N	2026-05-08 15:43:21.087972+00
11	student_activation_started	\N	\N	\N	1	{"account_type": "student", "activation_id": "3230343a-e82c-49ac-86b7-f69a647df0c8"}	success	\N	2026-05-28 06:58:52.522871+00
12	student_activation_verified	\N	\N	\N	1	{"account_type": "student", "activation_id": "3230343a-e82c-49ac-86b7-f69a647df0c8"}	success	\N	2026-05-28 06:59:15.769194+00
\.


--
-- Data for Name: auth_refresh_sessions; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.auth_refresh_sessions (id, user_id, token_hash, family_id, replaced_by_session_id, user_agent, ip_address, expires_at, revoked_at, created_at, last_used_at) FROM stdin;
1	1	9c684e1a7e0056effd03db32ecd3d24ce905a9114323505a67811d25ee52753e	c7c0827a-0b4d-44ce-8e00-daf858f7ff40	\N	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-13 04:01:05.855676+00	\N	2026-05-14 04:01:05.602387+00	\N
2	1	c562b435d5f5d44c41e6f5c38bd197c08dac16f3eff6a9b0583346637551462b	52794367-b356-45a9-9bbe-30a3b151237d	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:03:05.320493+00	\N	2026-05-14 04:03:05.080988+00	\N
3	7	7b45fdd0aead42d1263b02cc2b03f1bca1a6e3f9a12f66cf34f3a8949ac36503	9d46ce3c-0a01-494f-9d6a-3331d04ce864	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:15:42.7054+00	\N	2026-05-14 04:15:42.445071+00	\N
4	1	00d74b8a39de071ba4349a8851c4d6b5eb05ee3e2fcec2f6f812a88a3de1fc93	25dd1349-a339-4790-979b-73c7b21e5fff	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:16:05.716543+00	\N	2026-05-14 04:16:05.44969+00	\N
5	7	c7c0a2dd7a579115958018017a6e2c96a7ef89a1f008a54dffa578635386838f	b3841434-f80a-4bce-8a7e-a3ed5d8478ff	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:16:28.925031+00	\N	2026-05-14 04:16:28.680059+00	\N
6	1	9236ed2f850591c7a8238e8490d5a88cf16814e6b8dc211b20e8e8df7e8c1866	5095572d-a030-4702-b671-62ef349fd269	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:17:01.83207+00	\N	2026-05-14 04:17:01.585562+00	\N
7	1	6cea794c826da3a7875c3d064bf461692afebad5871697868ef56bbe56e42ba0	29c31e55-9099-4bf1-bf32-38b9410e3e39	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:17:15.723359+00	\N	2026-05-14 04:17:15.473672+00	\N
8	7	d1eeda0e6a48ca34865bf4c6fc988f4e22d4b64c63aec3a05d97e28c6850126e	62b346ea-17ef-4ed7-8ea7-45772e78b587	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-13 04:17:28.287952+00	\N	2026-05-14 04:17:28.036122+00	\N
9	1	60437cff233dc59859dcc6e04a9383c4f2077876ddaf0d277b9d32b91d53a41e	930c4b20-f158-45be-927d-1643ada1987a	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.3	2026-06-15 16:19:11.768685+00	\N	2026-05-16 16:19:11.490875+00	\N
16	1	137258b73b2c678397e9728b5835246ede5eed441ca044e5627395842aa5e478	c633805b-167d-42cb-b836-4b8144072c67	17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-16 17:36:35.483702+00	2026-05-18 01:32:35.427222+00	2026-05-17 17:36:35.477137+00	2026-05-18 01:32:35.40327+00
10	7	a1a8b9ff9e2ce6cea8feb08e86e2cc1b6c8af335844b67edb404557b5e5c16a2	3f41c5c3-1a5f-4913-8ab4-e0add44b3ab3	11	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.3	2026-06-15 16:21:04.575471+00	2026-05-17 07:30:31.944811+00	2026-05-16 16:21:04.311893+00	2026-05-17 07:30:31.951374+00
11	7	554882edab2cc9f407e9632e0c25fe3a6fdd966bf0a22b545827f87272c8c007	3f41c5c3-1a5f-4913-8ab4-e0add44b3ab3	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.3	2026-06-16 07:30:31.991349+00	2026-05-17 07:30:31.944811+00	2026-05-17 07:30:31.962913+00	\N
12	7	be2218c4682cc4db35afa72d58995e991367456162d009f695dcb9200e85ce1a	4c1c940c-27a7-4a68-89c6-e925cd06d3d4	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-16 08:41:31.95349+00	\N	2026-05-17 08:41:31.671356+00	\N
13	1	9e1ffe5baee6df15ed6a019e5ada10b006524efce17fc9217f45b82c6db5ac66	0b7bdbe1-3133-46c9-bdf9-fc67cb88746a	\N	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-16 08:42:03.661098+00	2026-05-17 09:40:52.923358+00	2026-05-17 08:42:03.417769+00	\N
14	7	4e0b11b7f99a61d753338af326d94ae4a027507129c4bcd310a9a23092e4ca3f	0f80ed49-c22b-4a4f-b26f-93acac7b5819	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-16 09:41:05.301292+00	\N	2026-05-17 09:41:05.036686+00	\N
15	1	3209c6adefc8f612c2087d1c6e01a21597d3019e5e72518b0ead4ca66b3297ce	c633805b-167d-42cb-b836-4b8144072c67	16	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-16 09:41:14.91315+00	2026-05-17 17:36:35.488046+00	2026-05-17 09:41:14.668109+00	2026-05-17 17:36:35.466933+00
17	1	bd3335d08d145e22f130087a9cacc05b9f496f88455c3f45a273637a7d4868fb	c633805b-167d-42cb-b836-4b8144072c67	18	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-17 01:32:35.420093+00	2026-05-18 09:28:16.994185+00	2026-05-18 01:32:35.410211+00	2026-05-18 09:28:16.891736+00
18	1	e71f109092dd01820e3462f33ad134dcff183f1cd1ab91c682a9144a6e47ba5b	c633805b-167d-42cb-b836-4b8144072c67	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-17 09:28:16.975338+00	2026-05-18 09:47:14.675232+00	2026-05-18 09:28:16.924787+00	\N
19	8	21f4479e98120ea34c0406139ad1e7fe34fb3b2e51db72a7daac43a7176cf6b2	cca4697e-a059-4e4c-8464-d609b48863b9	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-17 09:47:17.112267+00	2026-05-18 09:48:23.237051+00	2026-05-18 09:47:16.857+00	\N
20	1	fa3893f264381fd188876ea43c32dd7e4051a1e8ddf3d4cd5fc7fc145ff4e75b	ef6ec09e-275f-45c9-ae7a-ea785406d58d	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-17 09:48:30.507283+00	\N	2026-05-18 09:48:30.255311+00	\N
21	1	b5914116c1e600777235c88066782e78f20c9008912c066247ca40510b786e54	62716bd3-37ee-4c0d-80a6-805e55650e44	\N	curl/8.9.1	192.168.65.1	2026-06-17 15:05:49.929298+00	\N	2026-05-18 15:05:49.613289+00	\N
22	1	1d45300929d7adfe353a6930fab1e36d919d980911429b69961439f21303f869	933e142b-7fdb-47af-a6c1-4fe9a49e7e2d	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	192.168.65.1	2026-06-17 15:06:36.320704+00	\N	2026-05-18 15:06:36.000106+00	\N
23	1	dc1ae95a197db748cdede23e0aeaf1cc8cb9d06930e7b3a7c75169c333bf8327	c4618559-401f-4021-b12c-284aa7fc05d8	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	192.168.65.1	2026-06-17 15:10:09.1825+00	\N	2026-05-18 15:10:08.898815+00	\N
24	1	72e3aa908e053f536ac399aeb7da1540df18053514a6dfd3e46bb34a2f3a545c	640c91df-5001-4215-b2bb-21196a4c89cd	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	192.168.65.1	2026-06-17 15:10:32.95163+00	\N	2026-05-18 15:10:32.689678+00	\N
34	1	873e5f7a1aa05a5f98dcbc17c3a2fd10fb95ea60a6ff22b905ef74dba53c9dd1	167b2883-b46a-4bd3-99ce-786c0eb675bf	35	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-19 19:07:23.361754+00	2026-05-21 03:02:44.861322+00	2026-05-20 19:07:23.075622+00	2026-05-21 03:02:44.751925+00
25	1	914b5cd6ed16242e01e246952a37827c60b251fd33a056ce23fa533d4a10c08f	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	26	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-17 17:07:35.735954+00	2026-05-19 01:02:44.757127+00	2026-05-18 17:07:35.437342+00	2026-05-19 01:02:44.629072+00
37	1	00abe6b16aa3e4a9f125a582a9f8b9b0209fa76bdedc643052ca7d5320c888df	167b2883-b46a-4bd3-99ce-786c0eb675bf	38	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-20 18:53:52.114954+00	2026-05-22 02:49:53.010644+00	2026-05-21 18:53:52.091534+00	2026-05-22 02:49:52.996368+00
26	1	f5ba68c8bf97502cd956475099c0b20e232ba2ecb26f0919fec564f5e9940f40	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	27	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-18 01:02:44.736156+00	2026-05-19 01:02:44.860543+00	2026-05-19 01:02:44.672771+00	2026-05-19 01:02:44.855826+00
27	1	b942168b56be2b4b61ffa80a488f901bc1fdd84da35cff8ea9b53ff611f0f89a	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	28	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-18 01:02:44.859357+00	2026-05-19 01:02:44.880858+00	2026-05-19 01:02:44.856544+00	2026-05-19 01:02:44.875381+00
35	1	7cecab880198714f1ec0dd34f3d0a614dc7ef775cbe55b2912bbcbc8f0368e04	167b2883-b46a-4bd3-99ce-786c0eb675bf	36	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-20 03:02:44.83739+00	2026-05-21 10:58:43.124846+00	2026-05-21 03:02:44.790339+00	2026-05-21 10:58:43.029407+00
28	1	3f4239b92938f9437373f1f8f1abd47a673e11e9f99ab01ea16cf4dab79153b5	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	29	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-18 01:02:44.879646+00	2026-05-19 08:57:51.399767+00	2026-05-19 01:02:44.876081+00	2026-05-19 08:57:51.25967+00
41	1	c68b1246dc5423aec1ee14eec95683e5288a068105f53f37b48e00f0bc625504	d63c5c3a-0055-40a3-90f3-8cfbd59eb5c2	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-25 10:16:35.984116+00	2026-05-26 16:10:58.518048+00	2026-05-26 10:16:35.70324+00	\N
30	1	668b67e8ace8d70b9aaae80e36d12c6806d3deb68ec1396d444dbd9b3379d05b	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-18 08:57:51.491386+00	\N	2026-05-19 08:57:51.48277+00	\N
29	1	478334e189fb4326fe067ea3c3dd93768fedd56f4a70bf754691e2c5eff6fc63	8e33dbfa-7399-4d5e-adb8-63a3cd5c20d6	30	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-18 08:57:51.363896+00	2026-05-19 08:57:51.496276+00	2026-05-19 08:57:51.280851+00	2026-05-19 08:57:51.482103+00
31	1	069b4c4bc79eafd60b78c871d00ed9ae301f3a7a55621869978624185c164069	d2e48618-72b2-4f16-8cbe-b8898abfde92	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-19 04:25:33.423106+00	2026-05-20 04:26:46.888918+00	2026-05-20 04:25:33.102577+00	\N
32	7	695a86666e542b636a2bc299d26e31720b5b3ce0acf53380aa1b0dd6c706d160	3e8907b3-9822-49f6-9e7a-91e395da456d	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-19 04:26:50.707492+00	\N	2026-05-20 04:26:50.46111+00	\N
33	7	64dd086e66102018ad37a34a457e39e927cc0b35be2666f7023b9e62d731fbf0	34bdb120-3487-44f0-819f-eda1737d1320	\N	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-19 15:02:44.24963+00	\N	2026-05-20 15:02:43.95615+00	\N
39	1	112b307a1c3825e22b18953f6e7f57f31dd96a499906d612d04486c1ac0d2cfc	167b2883-b46a-4bd3-99ce-786c0eb675bf	\N	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-21 10:45:24.895527+00	\N	2026-05-22 10:45:24.873945+00	\N
36	1	4d4b8578596b82ae8f2040e00cf8d496eb31ad40bb808b2e3a583eea0824adc9	167b2883-b46a-4bd3-99ce-786c0eb675bf	37	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-20 10:58:43.104352+00	2026-05-21 18:53:52.128224+00	2026-05-21 10:58:43.054744+00	2026-05-21 18:53:52.078082+00
42	7	8f585648a3070dae1727a237b6791cd5a75f0aa4fd81578eae2df51473e73c50	8ccf60b4-6823-4d8a-845d-068aef1899cf	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-25 16:11:03.618167+00	\N	2026-05-26 16:11:03.34419+00	\N
38	1	c13e1b129f10a015d1c1afa3d3c147c94c1812150c3b7afeb76a60a449a25208	167b2883-b46a-4bd3-99ce-786c0eb675bf	39	Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36	172.18.0.4	2026-06-21 02:49:53.006126+00	2026-05-22 10:45:24.909632+00	2026-05-22 02:49:52.999653+00	2026-05-22 10:45:24.862867+00
40	1	1985c13e5a0062fb4cfedea7b18a2ad6ae9ef77f40694ec9011cf04a628959ba	66d7131b-cfae-48ee-bc14-19f5287c0546	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.2	2026-06-25 09:35:36.511803+00	2026-05-26 10:16:18.468717+00	2026-05-26 09:35:36.061993+00	\N
44	1	46003908354c8de1641ac82279e6b0e6864129d5889f46de1aee18b86406e628	33140a77-bbe5-49f8-975c-b4cb58464f70	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	172.18.0.4	2026-06-25 17:10:26.018547+00	\N	2026-05-26 17:10:25.465971+00	\N
45	1	d61f27d3e4c959b4e6e2df6dd0a252f95a0c2578361e0527fe8a6d74924b393c	e074c6c4-a257-4277-b8e3-c8edb6bd35cb	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	172.18.0.4	2026-06-25 17:11:17.963801+00	\N	2026-05-26 17:11:17.717178+00	\N
46	1	b5bc41c7c56a0c0c6d833751b302a4d9e2ddf3219859326705c8023c8ef18f7c	aff72612-01ef-4c1d-af59-697fd852a3e0	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	172.18.0.4	2026-06-25 17:11:37.611995+00	\N	2026-05-26 17:11:37.356394+00	\N
47	1	f2ddf86e405ed215b1f79d679d391280bf6a19be890fad42e5a793d21fd1bdf8	640f70f9-d06a-4396-b29a-c270b1c75a4b	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36	172.18.0.4	2026-06-25 17:12:13.623928+00	\N	2026-05-26 17:12:13.374778+00	\N
43	1	7087503eb10846cd7241670eaf9cf47497005edcab8a0f5c3fe4d14004a2a890	467635ea-a556-48f6-a8cc-737cb5ca30ba	48	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-25 16:13:58.515099+00	2026-05-27 00:09:42.229746+00	2026-05-26 16:13:58.252604+00	2026-05-27 00:09:42.120174+00
50	1	afc4602b0e023228433f07cc5f96f7d2d493f15c8c84d3816c4842b29d0a2fe1	00bb4d52-991f-418d-afdd-a8c054bcf5cf	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Codex/26.519.41501 Chrome/148.0.7778.97 Electron/42.1.0 Safari/537.36	192.168.65.1	2026-06-26 04:38:57.283577+00	\N	2026-05-27 04:38:56.956458+00	\N
53	14	9727915b090ceb6ce335d2b976f8fc7e03001eeaf0b63f6e0a3e3318f3af304b	9ac0bd3d-6e2e-464a-a4fd-8a8666a675fe	60	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	172.18.0.4	2026-06-27 05:12:40.609668+00	2026-05-30 02:27:44.555121+00	2026-05-28 05:12:40.60184+00	2026-05-30 02:27:44.342813+00
51	1	4801e0293f6fd7ee22d7551dcdff8351f2053102fd94df8ed0955d1c4113ecc3	467635ea-a556-48f6-a8cc-737cb5ca30ba	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-26 08:05:34.5216+00	\N	2026-05-27 08:05:34.446487+00	\N
48	1	5fbc9b0ecc90521ba1ef7a9c146ef35e84bdd96ee69059419069070ce6b3e5de	467635ea-a556-48f6-a8cc-737cb5ca30ba	51	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-26 00:09:42.191724+00	2026-05-27 08:05:34.580141+00	2026-05-27 00:09:42.153301+00	2026-05-27 08:05:34.40839+00
49	14	e703237fa2c898850c5bdddc3066d849ace3f07a2ab5d5efc6b235205e001099	9ac0bd3d-6e2e-464a-a4fd-8a8666a675fe	52	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	172.18.0.4	2026-06-26 04:15:14.827783+00	2026-05-28 05:12:40.471601+00	2026-05-27 04:15:14.563945+00	2026-05-28 05:12:40.012183+00
61	14	92b53edcae0a68602877720abf4a5c6641ac5c44528d90798f4b9c201a0d064e	9ac0bd3d-6e2e-464a-a4fd-8a8666a675fe	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	172.18.0.4	2026-06-29 02:27:47.000451+00	\N	2026-05-30 02:27:46.991355+00	\N
52	14	5acd814fa29fab2fb992ed75b105976a1e68730fadcbc2f54929fd21fd5c701a	9ac0bd3d-6e2e-464a-a4fd-8a8666a675fe	53	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	172.18.0.4	2026-06-27 05:12:40.387618+00	2026-05-28 05:12:40.611772+00	2026-05-28 05:12:40.08911+00	2026-05-28 05:12:40.598499+00
54	1	4883120cca7246a762732e5204b115df420057bf746b78d1e18a320a7b713f38	aea3c5c9-aa8f-4a5b-bca6-ea68ca7a2471	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 05:13:10.984263+00	2026-05-28 05:14:35.234299+00	2026-05-28 05:13:10.68342+00	\N
55	7	3b3b0588ae6bfdb7c1fd74c8ab3b263417646d5cbfa4ac39b33dfef9d5158bc1	81ce3b0c-fc3c-4ea0-b988-8cd74a81638c	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 05:14:39.161906+00	\N	2026-05-28 05:14:38.904158+00	\N
56	1	dc1fa86f2a4930ef411a5f3d6783ed0ea005a6df09650846f3314bc97e806aee	cb7d30b0-98e9-4c19-b23a-a961f1efcfe6	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 05:16:16.040504+00	2026-05-28 07:18:47.587394+00	2026-05-28 05:16:15.793067+00	\N
57	7	bca6ea70128b005e3ce2bece4c7bab75d29cc6d6b942f9db1340f6f127e7e716	5d546f53-226b-47d8-9475-2df9baf375b1	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 07:18:52.521659+00	\N	2026-05-28 07:18:52.236906+00	\N
58	1	a0ee5436b9a43838c14788512d6a43dd77300aa5416f4f9d1e14fa772465f7ec	63492944-e494-4d25-8a10-9f4b2a5c97ff	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 07:19:00.550404+00	2026-05-28 07:19:30.606479+00	2026-05-28 07:19:00.307372+00	\N
59	7	cc49efd7434b62313a0ab01e02f9921f35f3fc7ed54a27d51145bf52820e8b46	7323885c-9b5e-4367-9e80-77b13ff9ba30	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-06-27 07:19:34.453207+00	\N	2026-05-28 07:19:34.197213+00	\N
60	14	b5160c4429173f19f6e045c8dd27c1b9c61b591dd7ff10593b38ab78644db8ee	9ac0bd3d-6e2e-464a-a4fd-8a8666a675fe	61	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	172.18.0.4	2026-06-29 02:27:44.485357+00	2026-05-30 02:27:47.002346+00	2026-05-30 02:27:44.404912+00	2026-05-30 02:27:46.977435+00
62	7	462102098d774445ab36114cf079c2965e563b9c7c3ffc683abc10a7993bc907	9aa2299c-4014-4b11-8a90-db7918e12ab9	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-07-01 09:30:34.543318+00	\N	2026-06-01 09:30:34.180365+00	\N
63	1	b29dd24b10d6269bce959c2fbaf898d7feeda0e1ac2f7b61cf6bae98f528f860	c1e9bfff-ce9e-45e6-9c8a-db46173cb2b7	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	172.18.0.4	2026-07-01 09:30:43.196198+00	\N	2026-06-01 09:30:42.949701+00	\N
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.branches (id, name, address, phone, gseb_affiliation_no, is_active, created_at) FROM stdin;
1	Iqra English Medium School — Main Campus	\N	\N	\N	t	2026-05-10 10:31:49.191485+00
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.classes (id, name, division, academic_year_id, capacity, medium, promotion_status, branch_id) FROM stdin;
1	5	A	1	40	English	not_started	\N
2	7	A	1	40	English	not_started	\N
3	10	A	1	40	English	not_started	\N
4	5	A	2	40	English	not_started	\N
5	7	A	2	40	English	not_started	\N
6	10	A	2	40	English	not_started	\N
7	Nursery	A	1	\N	English	not_started	\N
8	LKG	A	1	\N	English	not_started	\N
9	UKG	A	1	\N	English	not_started	\N
10	1	A	1	\N	English	not_started	\N
11	2	A	1	\N	English	not_started	\N
12	3	A	1	\N	English	not_started	\N
13	4	A	1	\N	English	not_started	\N
14	6	A	1	\N	English	not_started	\N
15	8	A	1	\N	English	not_started	\N
16	9	A	1	\N	English	not_started	\N
\.


--
-- Data for Name: data_audit_logs; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.data_audit_logs (id, user_id, action, table_name, record_id, old_value, new_value, created_at) FROM stdin;
1	7	create	fee_payments	7	null	{"id": 7, "student_fee_id": 6, "amount_paid": "300.00", "payment_date": "2026-05-11", "mode": "online", "receipt_number": "RCPT-2026-00005", "collected_by": null, "online_order_id": 8, "notes": "Razorpay payment pay_Snx8CVQGTjMYKI"}	2026-05-11 06:09:04.704009+00
2	1	update	students	6	{"id": 6, "student_id": "OLD-2024-001", "gr_number": "GR2024001", "name_en": "Aarav Patel", "name_gu": "\\u0a86\\u0ab0\\u0ab5 \\u0aaa\\u0a9f\\u0ac7\\u0ab2", "dob": "2013-05-12", "gender": "M", "class_id": 2, "roll_number": 1, "father_name": "Rakesh Patel", "mother_name": "Pooja Patel", "contact": "9876543210", "student_email": "aarav.student@example.com", "student_phone": "9876543210", "guardian_email": "rakesh.parent@example.com", "guardian_phone": "9876543210", "address": "Palanpur, Gujarat", "category": "GEN", "aadhar_last4": "1234", "admission_date": "2024-06-01", "academic_year_id": 1, "branch_id": null, "student_user_id": null, "parent_user_id": null, "status": "Active", "photo_path": null, "reason_for_leaving": null, "previous_school": "Iqra Primary School", "created_at": "2026-05-10T04:30:38.712620+00:00"}	{"id": 6, "student_id": "OLD-2024-001", "gr_number": "GR2024001", "name_en": "Aarav Patel", "name_gu": "\\u0a86\\u0ab0\\u0ab5 \\u0aaa\\u0a9f\\u0ac7\\u0ab2", "dob": "2013-05-12", "gender": "M", "class_id": 2, "roll_number": 1, "father_name": "Rakesh Patel", "mother_name": "Pooja Patel", "contact": "9876543210", "student_email": "sohelmanasiya4@gmail.com", "student_phone": "9876543210", "guardian_email": "sohelmanasiya4@gmail.com", "guardian_phone": "9876543210", "address": "Palanpur, Gujarat", "category": "GEN", "aadhar_last4": "1234", "admission_date": "2024-06-01", "academic_year_id": 1, "branch_id": null, "student_user_id": null, "parent_user_id": null, "status": "Active", "photo_path": null, "reason_for_leaving": null, "previous_school": "Iqra Primary School", "created_at": "2026-05-10T04:30:38.712620+00:00"}	2026-05-14 04:13:50.842515+00
3	1	update	profile_correction_requests	1	{"status": "pending", "field_name": "address", "current_value": "12 Gandhi Nagar, Palanpur", "requested_value": "18 Gandhi Nagar, Palanpur"}	{"status": "rejected", "admin_note": null, "resolved_by_user_id": 1}	2026-05-14 04:16:20.003354+00
4	1	update	students	1	{"id": 1, "student_id": "STU-2025-001", "gr_number": "GR2025001", "name_en": "Aryan Patel", "name_gu": "\\u0a86\\u0ab0\\u0acd\\u0aaf\\u0aa8 \\u0aaa\\u0a9f\\u0ac7\\u0ab2", "dob": "2012-04-15", "gender": "M", "class_id": 2, "roll_number": 1, "father_name": "Ramesh Patel", "mother_name": "Sunita Patel", "contact": "9876543201", "student_email": "manasiyasahal98@gmail.com", "student_phone": "9876543201", "guardian_email": "vt8615154@gmail.com", "guardian_phone": "9876543201", "address": "12 Gandhi Nagar, Palanpur", "category": "GEN", "aadhar_last4": null, "admission_date": "2025-06-01", "academic_year_id": 1, "branch_id": null, "student_user_id": 6, "parent_user_id": 7, "status": "Active", "photo_path": null, "reason_for_leaving": null, "previous_school": null, "created_at": "2026-05-07T08:10:42.900544+00:00"}	{"id": 1, "student_id": "STU-2025-001", "gr_number": "GR2025001", "name_en": "Aryan Patel", "name_gu": "\\u0a86\\u0ab0\\u0acd\\u0aaf\\u0aa8 \\u0aaa\\u0a9f\\u0ac7\\u0ab2", "dob": "2012-04-15", "gender": "M", "class_id": 2, "roll_number": 1, "father_name": "Ramesh Patel", "mother_name": "Sunita Patel", "contact": "9876543201", "student_email": "manasiyasahal98@gmail.com", "student_phone": "9876543201", "guardian_email": "vt8615154@gmail.com", "guardian_phone": "9876543201", "address": "18 Gandhi Nagar, Palanpur", "category": "GEN", "aadhar_last4": null, "admission_date": "2025-06-01", "academic_year_id": 1, "branch_id": null, "student_user_id": 6, "parent_user_id": 7, "status": "Active", "photo_path": null, "reason_for_leaving": null, "previous_school": null, "created_at": "2026-05-07T08:10:42.900544+00:00"}	2026-05-14 04:17:10.121237+00
5	1	update	profile_correction_requests	2	{"status": "pending", "field_name": "address", "current_value": "12 Gandhi Nagar, Palanpur", "requested_value": "18 Gandhi Nagar, Palanpur"}	{"status": "approved", "admin_note": null, "resolved_by_user_id": 1}	2026-05-14 04:17:10.121237+00
6	7	create	fee_payments	8	null	{"id": 8, "student_fee_id": 6, "amount_paid": "9700.00", "payment_date": "2026-05-16", "mode": "online", "receipt_number": "RCPT-2026-00006", "collected_by": null, "online_order_id": 9, "notes": "Razorpay payment pay_Sq6Fysb3QItv5m"}	2026-05-16 16:22:46.724157+00
7	7	create	fee_payments	9	null	{"id": 9, "student_fee_id": 3, "amount_paid": "9700.00", "payment_date": "2026-05-20", "mode": "online", "receipt_number": "RCPT-2026-00007", "collected_by": null, "online_order_id": 10, "notes": "Razorpay payment pay_SrUD75BZxNmcmo"}	2026-05-20 04:27:39.725271+00
8	1	create	students	7	null	{"id": 7, "student_id": "SMS-2026-001", "gr_number": "90", "name_en": "mohammad imran machhaliya", "name_gu": "in gujarati", "dob": "2010-06-18", "gender": "M", "class_id": 3, "roll_number": 21, "father_name": "imranbhai machhaliya", "mother_name": "arefaben machhaliya ", "contact": "9999999999", "student_email": "idontknow999975@gmail.com", "student_phone": "9999999999", "guardian_email": "idontknow999975@gmail.com", "guardian_phone": "9999999999", "address": "", "category": "GEN", "aadhar_last4": "9009", "admission_date": "2026-05-28", "academic_year_id": 1, "branch_id": null, "student_user_id": null, "parent_user_id": null, "status": "Active", "photo_path": null, "reason_for_leaving": null, "previous_school": null, "created_at": "2026-05-28T06:54:47.031984+00:00"}	2026-05-28 06:54:47.851591+00
9	7	create	fee_payments	10	null	{"id": 10, "student_fee_id": 5, "amount_paid": "500.00", "payment_date": "2026-05-28", "mode": "online", "receipt_number": "RCPT-2026-00008", "collected_by": null, "online_order_id": 11, "notes": "Razorpay payment pay_SuhQawjV772dsu"}	2026-05-28 07:20:26.872223+00
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.enrollments (id, student_id, academic_year_id, class_id, roll_number, status, promotion_action, promotion_status, enrolled_on, reason_for_leaving, created_at, original_roll_number) FROM stdin;
1	1	1	2	1	active	\N	not_started	2025-06-01	\N	2026-05-07 08:10:42.900544+00	1
2	2	1	2	2	active	\N	not_started	2025-06-01	\N	2026-05-07 08:10:42.900544+00	2
3	3	1	2	3	active	\N	not_started	2025-06-01	\N	2026-05-07 08:10:42.900544+00	3
4	4	1	1	1	active	\N	not_started	2025-06-01	\N	2026-05-07 08:10:42.900544+00	1
5	5	1	3	1	active	\N	not_started	2025-06-01	\N	2026-05-07 08:10:42.900544+00	1
6	6	1	2	1	active	\N	not_started	2024-06-01	\N	2026-05-10 04:30:38.71262+00	\N
7	7	1	3	21	active	\N	not_started	2026-05-28	\N	2026-05-28 06:54:47.031984+00	\N
\.


--
-- Data for Name: exam_subject_configs; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.exam_subject_configs (id, exam_id, subject_id, max_theory, max_practical) FROM stdin;
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.exams (id, name, class_id, exam_date, academic_year_id, weightage) FROM stdin;
1	Unit Test 1	1	2025-08-15	1	10.00
2	Half-Yearly	1	2025-11-20	1	30.00
3	Annual	1	2026-03-10	1	60.00
4	Unit Test 1	2	2025-08-15	1	10.00
5	Half-Yearly	2	2025-11-20	1	30.00
6	Annual	2	2026-03-10	1	60.00
7	Unit Test 1	3	2025-08-15	1	10.00
8	Half-Yearly	3	2025-11-20	1	30.00
9	Annual	3	2026-03-10	1	60.00
10	Annual	7	\N	1	\N
11	Unit Test 4	7	\N	1	\N
12	Unit Test 3	3	\N	1	\N
\.


--
-- Data for Name: fee_heads; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.fee_heads (id, name, frequency, description, is_active) FROM stdin;
1	Tuition Fee	Monthly	Monthly tuition	t
2	Exam Fee	Term	Exam and assessment fee	t
3	Activity Fee	Annual	Sports and activities	t
\.


--
-- Data for Name: fee_payments; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.fee_payments (id, student_fee_id, amount_paid, payment_date, mode, receipt_number, collected_by, online_order_id, notes) FROM stdin;
1	1	1200.00	2025-07-01	Cash	RCPT-2025-0001	School Admin	\N	\N
2	4	600.00	2025-07-05	UPI	RCPT-2025-0002	School Admin	\N	\N
3	3	300.00	2026-05-08	online	RCPT-2026-00001	\N	2	Razorpay payment pay_Smla52GCjC1MwH
4	2	500.00	2026-05-08	online	RCPT-2026-00002	\N	3	Razorpay payment pay_Smlc7wL6LPg3L7
5	4	600.00	2026-05-08	online	RCPT-2026-00003	\N	5	Razorpay payment pay_SmldBawBRZQlfw
6	5	500.00	2026-05-08	online	RCPT-2026-00004	\N	7	Razorpay payment pay_SmvOEEaRWC9Qy7
7	6	300.00	2026-05-11	online	RCPT-2026-00005	\N	8	Razorpay payment pay_Snx8CVQGTjMYKI
8	6	9700.00	2026-05-16	online	RCPT-2026-00006	\N	9	Razorpay payment pay_Sq6Fysb3QItv5m
9	3	9700.00	2026-05-20	online	RCPT-2026-00007	\N	10	Razorpay payment pay_SrUD75BZxNmcmo
10	5	500.00	2026-05-28	online	RCPT-2026-00008	\N	11	Razorpay payment pay_SuhQawjV772dsu
\.


--
-- Data for Name: fee_structures; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.fee_structures (id, class_id, fee_head_id, amount, due_date, academic_year_id) FROM stdin;
1	1	1	900.00	2025-07-15	1
2	1	2	350.00	2025-07-15	1
3	1	3	250.00	2025-07-15	1
4	2	1	1200.00	2025-07-15	1
7	3	1	1500.00	2025-07-15	1
8	3	2	700.00	2025-07-15	1
9	3	3	400.00	2025-07-15	1
6	2	3	10000.00	2025-07-15	1
5	2	2	1000.00	2025-07-15	1
\.


--
-- Data for Name: import_batch_items; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.import_batch_items (id, import_batch_id, entity_type, entity_id, action, payload, created_at) FROM stdin;
1	1	student	6	created	{"student_id": "OLD-2024-001", "gr_number": "GR2024001", "name_en": "Aarav Patel", "class_name": "7", "division": "A", "academic_year_label": "2025-26"}	2026-05-10 04:30:38.71262+00
\.


--
-- Data for Name: import_batches; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.import_batches (id, entity_type, file_name, file_format, merge_mode, status, total_rows, imported_rows, skipped_rows, error_rows, summary, rollback_summary, created_by_user_id, created_at, rolled_back_at) FROM stdin;
1	student	student-import-sample.csv	csv	skip_duplicates	completed	1	1	0	0	{"total_rows": 1, "ready_rows": 1, "invalid_rows": 0, "duplicate_rows": 0, "missing_class_rows": 0, "classes_to_create": [], "create_missing_classes": false, "created_classes": [], "created_students_preview": [{"id": 6, "student_id": "OLD-2024-001", "name_en": "Aarav Patel"}]}	\N	1	2026-05-10 04:30:38.71262+00	\N
\.


--
-- Data for Name: marks; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.marks (id, student_id, subject_id, exam_id, theory_marks, practical_marks, is_absent, locked_at, enrollment_id) FROM stdin;
16	4	1	3	78.00	0.00	f	\N	4
17	4	2	3	80.00	0.00	f	\N	4
18	4	3	3	83.00	0.00	f	\N	4
19	4	4	3	76.00	0.00	f	\N	4
20	4	5	3	72.00	0.00	f	\N	4
6	2	6	6	72.00	0.00	f	\N	2
7	2	7	6	75.00	0.00	f	\N	2
8	2	8	6	68.00	0.00	f	\N	2
9	2	9	6	81.00	0.00	f	\N	2
10	2	10	6	74.00	0.00	f	\N	2
11	3	6	6	94.00	0.00	f	\N	3
12	3	7	6	89.00	0.00	f	\N	3
13	3	8	6	96.00	0.00	f	\N	3
14	3	9	6	92.00	0.00	f	\N	3
15	3	10	6	90.00	0.00	f	\N	3
1	1	6	6	88.00	0.00	f	\N	1
2	1	7	6	82.00	0.00	f	\N	1
3	1	8	6	91.00	0.00	f	\N	1
4	1	9	6	85.00	0.00	f	\N	1
5	1	10	6	79.00	0.00	f	\N	1
21	5	11	9	65.00	0.00	f	\N	5
22	5	12	9	69.00	0.00	f	\N	5
23	5	13	9	71.00	0.00	f	\N	5
24	5	14	9	67.00	0.00	f	\N	5
25	5	15	9	73.00	0.00	f	\N	5
\.


--
-- Data for Name: notification_log; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.notification_log (id, student_id, notification_type, channel, recipient_phone, template_name, message_preview, status, error_message, idempotency_key, outbox_id, sent_at, created_at) FROM stdin;
1	3	fee_due	whatsapp	9876543203	fee_due_reminder	Hello Vikram Sharma, Dhruv Sharma has an outstanding fee of ₹2000. Please pay before this week.	failed	WhatsApp Cloud API is not configured	fee_due:2026-W19:3:whatsapp	5	\N	2026-05-07 12:54:49.758706+00
2	4	fee_due	whatsapp	9876543204	fee_due_reminder	Hello Ajay Modi, Riya Modi has an outstanding fee of ₹1500. Please pay before this week.	failed	WhatsApp Cloud API is not configured	fee_due:2026-W19:4:whatsapp	6	\N	2026-05-07 12:54:49.758706+00
3	5	fee_due	whatsapp	9876543205	fee_due_reminder	Hello Salim Ansari, Kabir Ansari has an outstanding fee of ₹2600. Please pay before this week.	failed	WhatsApp Cloud API is not configured	fee_due:2026-W19:5:whatsapp	7	\N	2026-05-07 12:54:49.758706+00
4	1	fee_due	whatsapp	9876543201	fee_due_reminder	Hello Ramesh Patel, Aryan Patel has an outstanding fee of ₹800. Please pay before this week.	failed	WhatsApp Cloud API is not configured	fee_due:2026-W19:1:whatsapp	8	\N	2026-05-07 12:54:49.758706+00
5	2	fee_due	whatsapp	9876543202	fee_due_reminder	Hello Imran Sheikh, Zoya Sheikh has an outstanding fee of ₹1400. Please pay before this week.	failed	WhatsApp Cloud API is not configured	fee_due:2026-W19:2:whatsapp	9	\N	2026-05-07 12:54:49.758706+00
6	4	low_attendance	whatsapp	9876543204	low_attendance_alert	Dear Ajay Modi, attendance alert for Riya Modi: 0.0% in April 2026. Minimum required is 75%.	failed	WhatsApp Cloud API is not configured	low_attendance:2026-04:4:whatsapp	10	\N	2026-05-07 12:54:59.606345+00
7	3	low_attendance	whatsapp	9876543203	low_attendance_alert	Dear Vikram Sharma, attendance alert for Dhruv Sharma: 0.0% in April 2026. Minimum required is 75%.	failed	WhatsApp Cloud API is not configured	low_attendance:2026-04:3:whatsapp	11	\N	2026-05-07 12:54:59.606345+00
8	1	low_attendance	whatsapp	9876543201	low_attendance_alert	Dear Ramesh Patel, attendance alert for Aryan Patel: 0.0% in April 2026. Minimum required is 75%.	failed	WhatsApp Cloud API is not configured	low_attendance:2026-04:1:whatsapp	12	\N	2026-05-07 12:54:59.606345+00
9	2	low_attendance	whatsapp	9876543202	low_attendance_alert	Dear Imran Sheikh, attendance alert for Zoya Sheikh: 0.0% in April 2026. Minimum required is 75%.	failed	WhatsApp Cloud API is not configured	low_attendance:2026-04:2:whatsapp	13	\N	2026-05-07 12:54:59.606345+00
10	5	low_attendance	whatsapp	9876543205	low_attendance_alert	Dear Salim Ansari, attendance alert for Kabir Ansari: 0.0% in April 2026. Minimum required is 75%.	failed	WhatsApp Cloud API is not configured	low_attendance:2026-04:5:whatsapp	14	\N	2026-05-07 12:54:59.606345+00
11	1	payment_confirmed	whatsapp	9876543201	payment_confirmation	Dear Ramesh Patel, payment of ₹300 received for Aryan Patel. Receipt No: RCPT-2026-00001.	failed	WhatsApp Cloud API is not configured	payment_confirmed:3:whatsapp	15	\N	2026-05-08 06:12:16.288915+00
12	1	payment_confirmed	whatsapp	9876543201	payment_confirmation	Dear Ramesh Patel, payment of ₹500 received for Aryan Patel. Receipt No: RCPT-2026-00002.	failed	WhatsApp Cloud API is not configured	payment_confirmed:4:whatsapp	16	\N	2026-05-08 06:14:05.94693+00
13	2	payment_confirmed	whatsapp	9876543202	payment_confirmation	Dear Imran Sheikh, payment of ₹600 received for Zoya Sheikh. Receipt No: RCPT-2026-00003.	failed	WhatsApp Cloud API is not configured	payment_confirmed:5:whatsapp	17	\N	2026-05-08 06:15:05.844361+00
14	\N	test	whatsapp	9558265140	payment_confirmation	Iqra School WhatsApp test message.	failed	Client error '404 Not Found' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404	test:whatsapp:9558265140:2026-05-08	18	\N	2026-05-08 07:34:35.721281+00
15	\N	test	whatsapp	9725147997	payment_confirmation	Iqra School WhatsApp test message.	failed	Client error '400 Bad Request' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400	test:whatsapp:9725147997:2026-05-08	19	\N	2026-05-08 08:21:32.899934+00
16	2	payment_confirmed	whatsapp	9876543202	payment_confirmation	Dear Imran Sheikh, payment of ₹500 received for Zoya Sheikh. Receipt No: RCPT-2026-00004.	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	payment_confirmed:6:whatsapp	21	\N	2026-05-08 15:47:53.783943+00
17	\N	test	whatsapp	9904147997	payment_confirmation	Iqra School WhatsApp test message.	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	test:whatsapp:9904147997:2026-05-09	22	\N	2026-05-09 17:17:53.135851+00
18	2	payment_confirmed	whatsapp	9876543202	payment_receipt_pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00005).	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	payment_receipt:7:whatsapp	23	\N	2026-05-11 06:09:04.714262+00
19	2	payment_confirmed	whatsapp	9876543202	payment_receipt_pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00006).	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	payment_receipt:8:whatsapp	28	\N	2026-05-16 16:22:46.737142+00
20	1	payment_confirmed	whatsapp	9876543201	payment_receipt_pdf	Payment receipt PDF queued for Aryan Patel (RCPT-2026-00007).	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	payment_receipt:9:whatsapp	51	\N	2026-05-20 04:27:39.740056+00
21	2	payment_confirmed	whatsapp	9876543202	payment_receipt_pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00008).	failed	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	payment_receipt:10:whatsapp	68	\N	2026-05-28 07:20:26.88867+00
\.


--
-- Data for Name: notification_outbox; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.notification_outbox (id, provider, destination, subject, body, payload, status, attempts, max_attempts, next_attempt_at, last_error, sent_at, created_at, updated_at) FROM stdin;
1	email	manasiyasahal98@gmail.com	Your school portal activation code	Hello Aryan Patel,\n\nYour student portal activation code is 738870.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822", "account_type": "student", "student_id": "STU-2025-001"}	sent	1	3	2026-05-07 08:11:06.604552+00	\N	2026-05-07 08:11:11.537172+00	2026-05-07 08:11:06.604552+00	2026-05-07 08:11:11.56303+00
2	email	manasiyasahal98@gmail.com	Your school portal activation code	Hello Aryan Patel,\n\nYour student portal activation code is 101543.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "e5314ba1-1b3b-4405-be07-6be83c047822", "account_type": "student", "student_id": "STU-2025-001"}	sent	1	3	2026-05-07 08:16:53.47175+00	\N	2026-05-07 08:16:56.679046+00	2026-05-07 08:16:53.47175+00	2026-05-07 08:16:56.687502+00
3	email	manasiyasahal98@gmail.com	Your school portal activation code	Hello Aryan Patel,\n\nYour parent portal activation code is 753876.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "05b62c63-5cba-425a-946b-6dff12c5270d", "account_type": "parent", "student_id": "STU-2025-001"}	sent	1	3	2026-05-07 08:21:43.380392+00	\N	2026-05-07 08:21:52.261392+00	2026-05-07 08:21:43.380392+00	2026-05-07 08:21:52.285179+00
4	email	vt8615154@gmail.com	Your school portal activation code	Hello Aryan Patel,\n\nYour parent portal activation code is 568604.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "9b2dfdc1-3e3a-4ece-a558-e5a932fdbf89", "account_type": "parent", "student_id": "STU-2025-001"}	sent	1	3	2026-05-07 08:25:54.835804+00	\N	2026-05-07 08:25:57.438138+00	2026-05-07 08:25:54.835804+00	2026-05-07 08:25:57.442534+00
23	whatsapp	9876543202	RCPT-2026-00005.pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00005).	{"student_id": 2, "notification_type": "payment_confirmed", "message_type": "document", "document_link": "https://iqraschool.in/portal/api/v1/pdf/receipt/7?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXltZW50OjciLCJyb2xlIjoicmVjZWlwdCIsImV4cCI6MTc4MTA3MTc0NCwiaWF0IjoxNzc4NDc5NzQ0LCJqdGkiOiJmM2QxNGNjYy1iMjA3LTRkYzktODAwYy1kM2EyNjgyZDYyODAiLCJ0eXAiOiJwZGYtZG93bmxvYWQiLCJyZXNvdXJjZSI6InJlY2VpcHQ6NyJ9.W-3aiy3dNhtkUS6ZUO-GSVpuoASuuKjp9K1yMCk0syE", "filename": "RCPT-2026-00005.pdf", "caption": "Dear Imran Sheikh, fee payment receipt for Zoya Sheikh. Amount \\u20b9300."}	failed	3	3	2026-05-11 06:15:15.803005+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-11 06:09:04.714262+00	2026-05-11 06:15:17.207999+00
24	email	aarav.student@example.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=1xaRM1NK7QVz_bXu6gt73SfnZcw29p2n_aBHvD3ecag\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "81e3f87f-a3db-470f-932a-3c76bfa63af3", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=1xaRM1NK7QVz_bXu6gt73SfnZcw29p2n_aBHvD3ecag"}	sent	1	3	2026-05-14 04:12:07.498722+00	\N	2026-05-14 04:12:17.507067+00	2026-05-14 04:12:07.498722+00	2026-05-14 04:12:17.525303+00
5	whatsapp	9876543203	fee_due_reminder	Hello Vikram Sharma, Dhruv Sharma has an outstanding fee of ₹2000. Please pay before this week.	{"student_id": 3, "notification_type": "fee_due", "template_name": "fee_due_reminder", "params": ["Vikram Sharma", "Dhruv Sharma", "\\u20b92000", "school fees", "this week"]}	failed	3	3	2026-05-07 13:00:58.340456+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:49.758706+00	2026-05-07 13:00:58.68353+00
6	whatsapp	9876543204	fee_due_reminder	Hello Ajay Modi, Riya Modi has an outstanding fee of ₹1500. Please pay before this week.	{"student_id": 4, "notification_type": "fee_due", "template_name": "fee_due_reminder", "params": ["Ajay Modi", "Riya Modi", "\\u20b91500", "school fees", "this week"]}	failed	3	3	2026-05-07 13:00:58.340456+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:49.758706+00	2026-05-07 13:00:58.68353+00
7	whatsapp	9876543205	fee_due_reminder	Hello Salim Ansari, Kabir Ansari has an outstanding fee of ₹2600. Please pay before this week.	{"student_id": 5, "notification_type": "fee_due", "template_name": "fee_due_reminder", "params": ["Salim Ansari", "Kabir Ansari", "\\u20b92600", "school fees", "this week"]}	failed	3	3	2026-05-07 13:00:58.340456+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:49.758706+00	2026-05-07 13:00:58.68353+00
8	whatsapp	9876543201	fee_due_reminder	Hello Ramesh Patel, Aryan Patel has an outstanding fee of ₹800. Please pay before this week.	{"student_id": 1, "notification_type": "fee_due", "template_name": "fee_due_reminder", "params": ["Ramesh Patel", "Aryan Patel", "\\u20b9800", "school fees", "this week"]}	failed	3	3	2026-05-07 13:00:58.340456+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:49.758706+00	2026-05-07 13:00:58.68353+00
10	whatsapp	9876543204	low_attendance_alert	Dear Ajay Modi, attendance alert for Riya Modi: 0.0% in April 2026. Minimum required is 75%.	{"student_id": 4, "notification_type": "low_attendance", "template_name": "low_attendance_alert", "params": ["Ajay Modi", "Riya Modi", "0.0", "April 2026"]}	failed	3	3	2026-05-07 13:01:08.366785+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:59.606345+00	2026-05-07 13:01:08.736118+00
11	whatsapp	9876543203	low_attendance_alert	Dear Vikram Sharma, attendance alert for Dhruv Sharma: 0.0% in April 2026. Minimum required is 75%.	{"student_id": 3, "notification_type": "low_attendance", "template_name": "low_attendance_alert", "params": ["Vikram Sharma", "Dhruv Sharma", "0.0", "April 2026"]}	failed	3	3	2026-05-07 13:01:08.366785+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:59.606345+00	2026-05-07 13:01:08.736118+00
12	whatsapp	9876543201	low_attendance_alert	Dear Ramesh Patel, attendance alert for Aryan Patel: 0.0% in April 2026. Minimum required is 75%.	{"student_id": 1, "notification_type": "low_attendance", "template_name": "low_attendance_alert", "params": ["Ramesh Patel", "Aryan Patel", "0.0", "April 2026"]}	failed	3	3	2026-05-07 13:01:08.366785+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:59.606345+00	2026-05-07 13:01:08.736118+00
13	whatsapp	9876543202	low_attendance_alert	Dear Imran Sheikh, attendance alert for Zoya Sheikh: 0.0% in April 2026. Minimum required is 75%.	{"student_id": 2, "notification_type": "low_attendance", "template_name": "low_attendance_alert", "params": ["Imran Sheikh", "Zoya Sheikh", "0.0", "April 2026"]}	failed	3	3	2026-05-07 13:01:08.366785+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:59.606345+00	2026-05-07 13:01:08.736118+00
14	whatsapp	9876543205	low_attendance_alert	Dear Salim Ansari, attendance alert for Kabir Ansari: 0.0% in April 2026. Minimum required is 75%.	{"student_id": 5, "notification_type": "low_attendance", "template_name": "low_attendance_alert", "params": ["Salim Ansari", "Kabir Ansari", "0.0", "April 2026"]}	failed	3	3	2026-05-07 13:01:08.366785+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:59.606345+00	2026-05-07 13:01:08.736118+00
9	whatsapp	9876543202	fee_due_reminder	Hello Imran Sheikh, Zoya Sheikh has an outstanding fee of ₹1400. Please pay before this week.	{"student_id": 2, "notification_type": "fee_due", "template_name": "fee_due_reminder", "params": ["Imran Sheikh", "Zoya Sheikh", "\\u20b91400", "school fees", "this week"]}	failed	3	3	2026-05-07 13:00:58.340456+00	WhatsApp Cloud API is not configured	\N	2026-05-07 12:54:49.758706+00	2026-05-07 13:00:58.68353+00
22	whatsapp	9904147997	payment_confirmation	Iqra School WhatsApp test message.	{"student_id": null, "notification_type": "test", "template_name": "payment_confirmation", "params": ["Parent", "\\u20b91", "Test Student", "TEST-RECEIPT"]}	failed	3	3	2026-05-09 17:23:58.936262+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-09 17:17:53.135851+00	2026-05-09 17:23:59.845443+00
25	email	rakesh.parent@example.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=WxY-oUj2dm7-MXWAKxiPyj9QHkhPc8Rpmp8myDH2xTU\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "2f60a5d3-7433-42e6-ab58-e80a76bacc58", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=WxY-oUj2dm7-MXWAKxiPyj9QHkhPc8Rpmp8myDH2xTU"}	sent	1	3	2026-05-14 04:12:07.540469+00	\N	2026-05-14 04:12:17.507067+00	2026-05-14 04:12:07.540469+00	2026-05-14 04:12:22.3012+00
26	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=RuZCxUaH3KOMRYGHOLChvctMaFRJwrZeYrya6RVvVvQ\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "ee3899b7-3b5c-4fef-8bf1-c743d4e79567", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=RuZCxUaH3KOMRYGHOLChvctMaFRJwrZeYrya6RVvVvQ"}	sent	1	3	2026-05-14 04:14:02.498648+00	\N	2026-05-14 04:14:06.48959+00	2026-05-14 04:14:02.498648+00	2026-05-14 04:14:06.53269+00
15	whatsapp	9876543201	payment_confirmation	Dear Ramesh Patel, payment of ₹300 received for Aryan Patel. Receipt No: RCPT-2026-00001.	{"student_id": 1, "notification_type": "payment_confirmed", "template_name": "payment_confirmation", "params": ["Ramesh Patel", "\\u20b9300", "Aryan Patel", "RCPT-2026-00001"]}	failed	3	3	2026-05-08 06:18:20.701512+00	WhatsApp Cloud API is not configured	\N	2026-05-08 06:12:16.288915+00	2026-05-08 06:18:21.195716+00
16	whatsapp	9876543201	payment_confirmation	Dear Ramesh Patel, payment of ₹500 received for Aryan Patel. Receipt No: RCPT-2026-00002.	{"student_id": 1, "notification_type": "payment_confirmed", "template_name": "payment_confirmation", "params": ["Ramesh Patel", "\\u20b9500", "Aryan Patel", "RCPT-2026-00002"]}	failed	3	3	2026-05-08 06:20:10.925342+00	WhatsApp Cloud API is not configured	\N	2026-05-08 06:14:05.94693+00	2026-05-08 06:20:11.457183+00
17	whatsapp	9876543202	payment_confirmation	Dear Imran Sheikh, payment of ₹600 received for Zoya Sheikh. Receipt No: RCPT-2026-00003.	{"student_id": 2, "notification_type": "payment_confirmed", "template_name": "payment_confirmation", "params": ["Imran Sheikh", "\\u20b9600", "Zoya Sheikh", "RCPT-2026-00003"]}	failed	3	3	2026-05-08 06:21:11.0248+00	WhatsApp Cloud API is not configured	\N	2026-05-08 06:15:05.844361+00	2026-05-08 06:21:11.559756+00
27	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=GKngUuoC64RfNPey0Ee1sBaBryxfUCr0lOzLpQfPncY\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "2bb0cd37-db3c-4bf3-ad9c-72e79e04569b", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=GKngUuoC64RfNPey0Ee1sBaBryxfUCr0lOzLpQfPncY"}	sent	1	3	2026-05-14 04:14:02.525753+00	\N	2026-05-14 04:14:06.48959+00	2026-05-14 04:14:02.525753+00	2026-05-14 04:14:10.619114+00
18	whatsapp	9558265140	payment_confirmation	Iqra School WhatsApp test message.	{"student_id": null, "notification_type": "test", "template_name": "payment_confirmation", "params": ["Parent", "\\u20b91", "Test Student", "TEST-RECEIPT"]}	failed	3	3	2026-05-08 07:40:40.503061+00	Client error '404 Not Found' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404	\N	2026-05-08 07:34:35.721281+00	2026-05-08 07:40:41.747615+00
19	whatsapp	9725147997	payment_confirmation	Iqra School WhatsApp test message.	{"student_id": null, "notification_type": "test", "template_name": "payment_confirmation", "params": ["Parent", "\\u20b91", "Test Student", "TEST-RECEIPT"]}	failed	3	3	2026-05-08 08:27:41.408472+00	Client error '400 Bad Request' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400	\N	2026-05-08 08:21:32.899934+00	2026-05-08 08:27:42.640813+00
20	email	akshaydhumda@gmail.com	Your school portal activation code	Hello Riya chaudhry,\n\nYour student portal activation code is 169065.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "2b9f9faf-0ac8-48c3-a876-f519ee3207e0", "account_type": "student", "student_id": "STU-2025-004"}	sent	1	3	2026-05-08 15:43:21.087972+00	\N	2026-05-08 15:43:28.304216+00	2026-05-08 15:43:21.087972+00	2026-05-08 15:43:28.314744+00
31	email	kabir.student@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=Bwt6MmJr-IhRXzOHyBnX6DTx82AHO2iKW4BQ1P8AnBo\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "9a44a0ca-8dc5-46c3-a20c-b30197eaca1f", "account_type": "student", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/activate-account?invite=Bwt6MmJr-IhRXzOHyBnX6DTx82AHO2iKW4BQ1P8AnBo"}	sent	1	3	2026-05-18 14:49:55.071719+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.071719+00	2026-05-18 14:50:10.325998+00
21	whatsapp	9876543202	payment_confirmation	Dear Imran Sheikh, payment of ₹500 received for Zoya Sheikh. Receipt No: RCPT-2026-00004.	{"student_id": 2, "notification_type": "payment_confirmed", "template_name": "payment_confirmation", "params": ["Imran Sheikh", "\\u20b9500", "Zoya Sheikh", "RCPT-2026-00004"]}	failed	3	3	2026-05-08 15:54:03.433937+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-08 15:47:53.783943+00	2026-05-08 15:54:04.789689+00
28	whatsapp	9876543202	RCPT-2026-00006.pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00006).	{"student_id": 2, "notification_type": "payment_confirmed", "message_type": "document", "document_link": "https://iqraschool.in/portal/api/v1/pdf/receipt/8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXltZW50OjgiLCJyb2xlIjoicmVjZWlwdCIsImV4cCI6MTc4MTU0MDU2NiwiaWF0IjoxNzc4OTQ4NTY2LCJqdGkiOiJlOWJkNmQ3Yy00MDczLTRmODYtOGE4Ny05M2ZjNjIzMDA2ZmEiLCJ0eXAiOiJwZGYtZG93bmxvYWQiLCJyZXNvdXJjZSI6InJlY2VpcHQ6OCJ9.XJa444_97kXm0Xub4OQZMMnPoOWLEq6dVYuJ7DbM9fU", "filename": "RCPT-2026-00006.pdf", "caption": "Dear Imran Sheikh, fee payment receipt for Zoya Sheikh. Amount \\u20b99700."}	failed	3	3	2026-05-16 16:29:03.116424+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-16 16:22:46.737142+00	2026-05-16 16:35:12.309161+00
51	whatsapp	9876543201	RCPT-2026-00007.pdf	Payment receipt PDF queued for Aryan Patel (RCPT-2026-00007).	{"student_id": 1, "notification_type": "payment_confirmed", "message_type": "document", "document_link": "https://iqraschool.in/portal/api/v1/pdf/receipt/9?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXltZW50OjkiLCJyb2xlIjoicmVjZWlwdCIsImV4cCI6MTc4MTg0MzI1OSwiaWF0IjoxNzc5MjUxMjU5LCJqdGkiOiI1MzY2NWQ3OC04M2ZiLTQ5YWMtOTMzZi0zM2IyYzlmNGNlNmYiLCJ0eXAiOiJwZGYtZG93bmxvYWQiLCJyZXNvdXJjZSI6InJlY2VpcHQ6OSJ9.0asK2erPJCUKV4MEHHe8V-q5M_Z-TxCRbw7a5GnqZYI", "filename": "RCPT-2026-00007.pdf", "caption": "Dear Ramesh Patel, fee payment receipt for Aryan Patel. Amount \\u20b99700."}	failed	3	3	2026-05-20 04:43:52.969794+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-20 04:27:39.740056+00	2026-05-20 04:58:34.773407+00
52	email	msgoatfarm4@gmail.com	Complete your teacher account registration	Hello sahal,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttp://localhost:5173/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNCIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDIxMTE3LCJpYXQiOjE3Nzk4MTYzMTcsImp0aSI6IjU2NGE3NzAxLTNmY2YtNGQyNy1hZGYyLWMzZjJlNzA4MGIzNyIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Im1zZ29hdGZhcm00QGdtYWlsLmNvbSJ9.yHNGTA5ZWMWVO-sn45iZ96IezOPwHPyJGY-g4J34T1Q\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 14, "role": "teacher", "invite_url": "http://localhost:5173/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNCIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDIxMTE3LCJpYXQiOjE3Nzk4MTYzMTcsImp0aSI6IjU2NGE3NzAxLTNmY2YtNGQyNy1hZGYyLWMzZjJlNzA4MGIzNyIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Im1zZ29hdGZhcm00QGdtYWlsLmNvbSJ9.yHNGTA5ZWMWVO-sn45iZ96IezOPwHPyJGY-g4J34T1Q"}	sent	1	3	2026-05-26 17:25:17.276447+00	\N	2026-05-26 17:25:23.48159+00	2026-05-26 17:25:17.276447+00	2026-05-26 17:25:23.520361+00
57	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=BM6_PZlYXgo-CRcoRl-hTcZcKmOi2bCDjkL-ZZ6bfJE\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "d03650a2-1693-4efa-aea6-5f335db8dbc2", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "http://localhost/portal/activate-account?invite=BM6_PZlYXgo-CRcoRl-hTcZcKmOi2bCDjkL-ZZ6bfJE"}	sent	1	3	2026-05-28 06:58:09.436032+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.436032+00	2026-05-28 06:58:15.034762+00
58	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=-c_F4Zslbrm5Y9gMSXtHaGXq0V9jXY8UbVhrZDbSq_w\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "7eaa2601-84bd-49fb-8637-9e81b0adf3f1", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "http://localhost/portal/activate-account?invite=-c_F4Zslbrm5Y9gMSXtHaGXq0V9jXY8UbVhrZDbSq_w"}	sent	1	3	2026-05-28 06:58:09.500751+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.500751+00	2026-05-28 06:58:19.626444+00
60	email	salim.parent@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=3krYDWwno27InvINb8HY0tLlfRKVr6k1QZhJZKOkiho\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "83e537d3-482a-4547-9297-c4629629af5f", "account_type": "parent", "student_id": "STU-2025-005", "invite_url": "http://localhost/portal/activate-account?invite=3krYDWwno27InvINb8HY0tLlfRKVr6k1QZhJZKOkiho"}	sent	1	3	2026-05-28 06:58:09.528404+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.528404+00	2026-05-28 06:58:26.650855+00
65	email	idontknow999975@gmail.com	Activate your school portal account	Hello mohammad imran machhaliya,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=TnvApt_zNg-yYO2iSvtommfc2ZI0GM82YSd25lSXp5o\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "9cde64b3-9999-49c9-a533-0f314547e547", "account_type": "parent", "student_id": "SMS-2026-001", "invite_url": "http://localhost/portal/activate-account?invite=TnvApt_zNg-yYO2iSvtommfc2ZI0GM82YSd25lSXp5o"}	sent	1	3	2026-05-28 06:58:09.568392+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.568392+00	2026-05-28 06:58:44.28865+00
67	email	idontknow999975@gmail.com	Your school portal activation code	Hello mohammad imran machhaliya,\n\nYour student portal activation code is 638074.\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message or contact the school office.	{"activation_id": "3230343a-e82c-49ac-86b7-f69a647df0c8", "account_type": "student", "student_id": "SMS-2026-001"}	sent	1	3	2026-05-28 06:58:52.522871+00	\N	2026-05-28 06:58:58.137467+00	2026-05-28 06:58:52.522871+00	2026-05-28 06:59:02.167428+00
32	email	salim.parent@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=WTo4NWknkb9SNmFhSIK8iYb795MM2_IZgpK9qNRuKjA\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "51d31246-b9fb-42d0-a1a8-21721cb4acc2", "account_type": "parent", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/activate-account?invite=WTo4NWknkb9SNmFhSIK8iYb795MM2_IZgpK9qNRuKjA"}	sent	1	3	2026-05-18 14:49:55.081323+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.081323+00	2026-05-18 14:50:16.282948+00
35	email	zoya.student@example.com	Activate your school portal account	Hello Zoya Sheikh,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=03eGG9tI9p-iQKmMIsB5xt8vCGbG5A0SyK9_tMAsD1M\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "4f17a4ff-7c50-4de2-82a9-84b29e58ed99", "account_type": "student", "student_id": "STU-2025-002", "invite_url": "https://iqraschool.in/activate-account?invite=03eGG9tI9p-iQKmMIsB5xt8vCGbG5A0SyK9_tMAsD1M"}	sent	1	3	2026-05-18 14:49:55.103629+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.103629+00	2026-05-18 14:50:31.689982+00
53	email	idontknow999975@gmail.com	Complete your teacher account registration	Hello Meera Shah,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttp://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYwMDMzLCJpYXQiOjE3Nzk4NTUyMzMsImp0aSI6IjUwNGNlYzM2LWE1NjItNGVlYi05YzgxLTY1ZTRkY2FmNGUwZCIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.XtaaVibXRRFmHNvdLPo8-NOh1OM7mfjx2MREPrG7o7w\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 11, "role": "teacher", "invite_url": "http://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYwMDMzLCJpYXQiOjE3Nzk4NTUyMzMsImp0aSI6IjUwNGNlYzM2LWE1NjItNGVlYi05YzgxLTY1ZTRkY2FmNGUwZCIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.XtaaVibXRRFmHNvdLPo8-NOh1OM7mfjx2MREPrG7o7w"}	sent	1	3	2026-05-27 04:13:53.016352+00	\N	2026-05-27 04:13:58.890183+00	2026-05-27 04:13:53.016352+00	2026-05-27 04:13:58.928195+00
55	email	msgoatfarm4@gmail.com	Complete your teacher account registration	Hello sahal,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttp://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNCIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYwMDMzLCJpYXQiOjE3Nzk4NTUyMzMsImp0aSI6IjU5NmFlZjlmLWRhYzAtNGUyYi1hM2UxLWNlNmY4NDRhYTg4NiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Im1zZ29hdGZhcm00QGdtYWlsLmNvbSJ9.rqcpW6kw6ajUXJWvj6tFApcmzwxDoJFhlsqGbOs_pMY\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 14, "role": "teacher", "invite_url": "http://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNCIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYwMDMzLCJpYXQiOjE3Nzk4NTUyMzMsImp0aSI6IjU5NmFlZjlmLWRhYzAtNGUyYi1hM2UxLWNlNmY4NDRhYTg4NiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Im1zZ29hdGZhcm00QGdtYWlsLmNvbSJ9.rqcpW6kw6ajUXJWvj6tFApcmzwxDoJFhlsqGbOs_pMY"}	sent	1	3	2026-05-27 04:13:53.016352+00	\N	2026-05-27 04:13:58.890183+00	2026-05-27 04:13:53.016352+00	2026-05-27 04:14:08.426073+00
61	email	akshaydhumda@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=Cuqf1PVihJxWnBPTHPOsH_Jd-A8_yAstEI5Onw9xkQA\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "968b201a-f7ec-4d16-a20e-ab8b83895b82", "account_type": "student", "student_id": "STU-2025-004", "invite_url": "http://localhost/portal/activate-account?invite=Cuqf1PVihJxWnBPTHPOsH_Jd-A8_yAstEI5Onw9xkQA"}	sent	1	3	2026-05-28 06:58:09.538798+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.538798+00	2026-05-28 06:58:30.107961+00
66	email	idontknow999975@gmail.com	Activate your school portal account	Hello mohammad imran machhaliya,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=nvt0aizy8mL8M3Ep-wmfyIuPn9W7in7ZeyTcrpk21Fs\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "040e7879-d456-4e7b-8da2-e99d9228dc05", "account_type": "student", "student_id": "SMS-2026-001", "invite_url": "http://localhost/portal/activate-account?invite=nvt0aizy8mL8M3Ep-wmfyIuPn9W7in7ZeyTcrpk21Fs"}	sent	1	3	2026-05-28 06:58:48.243378+00	\N	2026-05-28 06:58:58.137467+00	2026-05-28 06:58:48.243378+00	2026-05-28 06:58:58.18311+00
54	email	sohelmanasiya4@gmail.com	Complete your teacher account registration	Hello mera ,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttp://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4Iiwicm9sZSI6InRlYWNoZXIiLCJleHAiOjE3ODA0NjAwMzMsImlhdCI6MTc3OTg1NTIzMywianRpIjoiZDMwNjc0ZDUtYTc2ZS00Mzg5LWJmYjUtMzkwMGFmOWJjNDEwIiwicHVycG9zZSI6InN0YWZmX3JlZ2lzdHJhdGlvbiIsImVtYWlsIjoic29oZWxtYW5hc2l5YTRAZ21haWwuY29tIn0.lh4mNRm6ayfZ2GAo73bnQZFEWOmQGLZSgvNR_t-AVA0\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 8, "role": "teacher", "invite_url": "http://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4Iiwicm9sZSI6InRlYWNoZXIiLCJleHAiOjE3ODA0NjAwMzMsImlhdCI6MTc3OTg1NTIzMywianRpIjoiZDMwNjc0ZDUtYTc2ZS00Mzg5LWJmYjUtMzkwMGFmOWJjNDEwIiwicHVycG9zZSI6InN0YWZmX3JlZ2lzdHJhdGlvbiIsImVtYWlsIjoic29oZWxtYW5hc2l5YTRAZ21haWwuY29tIn0.lh4mNRm6ayfZ2GAo73bnQZFEWOmQGLZSgvNR_t-AVA0"}	sent	1	3	2026-05-27 04:13:53.016352+00	\N	2026-05-27 04:13:58.890183+00	2026-05-27 04:13:53.016352+00	2026-05-27 04:14:04.132325+00
29	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=0lpcw79uMlq-6zha3S4Z-y9-xDvTNoeBcXipNPCWli0\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "6213c997-4868-4576-b7fb-6f4e2d19d6f2", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=0lpcw79uMlq-6zha3S4Z-y9-xDvTNoeBcXipNPCWli0"}	sent	1	3	2026-05-18 14:49:55.028744+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.028744+00	2026-05-18 14:50:00.22043+00
33	email	akshaydhumda@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=ynJvx57i5IVwAwIvb7GTHNUdaVmYKxPwuYmAvod2swE\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "a2de6de2-fb66-4f41-8408-274e873d89d3", "account_type": "student", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/activate-account?invite=ynJvx57i5IVwAwIvb7GTHNUdaVmYKxPwuYmAvod2swE"}	sent	1	3	2026-05-18 14:49:55.088606+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.088606+00	2026-05-18 14:50:21.234033+00
59	email	kabir.student@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=6GTLJ2LcoLT4sfmHlFnOJ8SivVHuzmm_c5rjJVgysbs\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "e3aaf45f-4063-4436-940a-476b10133e99", "account_type": "student", "student_id": "STU-2025-005", "invite_url": "http://localhost/portal/activate-account?invite=6GTLJ2LcoLT4sfmHlFnOJ8SivVHuzmm_c5rjJVgysbs"}	sent	1	3	2026-05-28 06:58:09.516672+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.516672+00	2026-05-28 06:58:23.202707+00
62	email	manasiyasahal@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=Q0E2dJAMtL_ssfoieoehTeALSHdsD5FoU-pPfzcptV4\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "ce41643a-b5ff-48e7-ab28-b4c4870e3ec7", "account_type": "parent", "student_id": "STU-2025-004", "invite_url": "http://localhost/portal/activate-account?invite=Q0E2dJAMtL_ssfoieoehTeALSHdsD5FoU-pPfzcptV4"}	sent	1	3	2026-05-28 06:58:09.546593+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.546593+00	2026-05-28 06:58:33.588832+00
68	whatsapp	9876543202	RCPT-2026-00008.pdf	Payment receipt PDF queued for Zoya Sheikh (RCPT-2026-00008).	{"student_id": 2, "notification_type": "payment_confirmed", "message_type": "document", "document_link": "http://localhost/portal/api/v1/pdf/receipt/10?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXltZW50OjEwIiwicm9sZSI6InJlY2VpcHQiLCJleHAiOjE3ODI1NDQ4MjYsImlhdCI6MTc3OTk1MjgyNiwianRpIjoiOTdlZmI5NTYtODRhOC00YTc0LTkyYTMtNGRmNjJjMWM2ZTc2IiwidHlwIjoicGRmLWRvd25sb2FkIiwicmVzb3VyY2UiOiJyZWNlaXB0OjEwIn0.GpR2tsDt-091FdgCROF_wfrecce2UxM2Qo_DvZlKsIo", "filename": "RCPT-2026-00008.pdf", "caption": "Dear Imran Sheikh, fee payment receipt for Zoya Sheikh. Amount \\u20b9500."}	failed	3	3	2026-05-28 07:26:35.303606+00	Client error '401 Unauthorized' for url 'https://graph.facebook.com/v18.0/1123180227542845/messages'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401	\N	2026-05-28 07:20:26.88867+00	2026-05-28 07:26:37.529717+00
30	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=uN3CTkHRPPM93u7_VFZ_zQ_SjlxLcESO6W0Jc5601rQ\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "166a4761-89d7-422f-bdd4-dff1695e42e0", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=uN3CTkHRPPM93u7_VFZ_zQ_SjlxLcESO6W0Jc5601rQ"}	sent	1	3	2026-05-18 14:49:55.061211+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.061211+00	2026-05-18 14:50:05.436184+00
56	email	idontknow999975@gmail.com	Complete your teacher account registration	Hello Meera Shah,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttp://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYyMzAyLCJpYXQiOjE3Nzk4NTc1MDIsImp0aSI6ImU5YTY5OWVhLTg5NjYtNGVlZi1iN2ZkLWNjMmM3YzU4M2Y1ZiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.1L-BJaqJBaUs9jfGI2Dpfg5KaKVNQLrsedFVJfpPcVM\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 11, "role": "teacher", "invite_url": "http://localhost/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzgwNDYyMzAyLCJpYXQiOjE3Nzk4NTc1MDIsImp0aSI6ImU5YTY5OWVhLTg5NjYtNGVlZi1iN2ZkLWNjMmM3YzU4M2Y1ZiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.1L-BJaqJBaUs9jfGI2Dpfg5KaKVNQLrsedFVJfpPcVM"}	sent	1	3	2026-05-27 04:51:42.854224+00	\N	2026-05-27 04:51:43.059815+00	2026-05-27 04:51:42.854224+00	2026-05-27 04:51:43.074813+00
34	email	manasiyasahal@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=a2mH0Hzvd7bACpBrLP3rNCJ4GxpcFPzcWGdKjco6lq8\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "e7f908b1-3aaf-4f9a-bed6-62799dc54ee6", "account_type": "parent", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/activate-account?invite=a2mH0Hzvd7bACpBrLP3rNCJ4GxpcFPzcWGdKjco6lq8"}	sent	1	3	2026-05-18 14:49:55.096241+00	\N	2026-05-18 14:50:00.199601+00	2026-05-18 14:49:55.096241+00	2026-05-18 14:50:27.024741+00
36	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=MrDgec9rgKS32gtctAn-uwS9aE13kvUYPBgRS_wbYis\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "898810dd-cf9e-455d-83ca-926bb028346d", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=MrDgec9rgKS32gtctAn-uwS9aE13kvUYPBgRS_wbYis"}	sent	1	3	2026-05-18 14:58:52.990131+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:52.990131+00	2026-05-18 14:58:55.676193+00
37	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=TyFHbElHMngVIU8OgQPiUC1rs18skOIjlOQBkDd-Sys\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "54a34cf2-0657-49f7-8164-2c0e06945066", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/activate-account?invite=TyFHbElHMngVIU8OgQPiUC1rs18skOIjlOQBkDd-Sys"}	sent	1	3	2026-05-18 14:58:53.034354+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.034354+00	2026-05-18 14:59:02.931292+00
38	email	kabir.student@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=RhvAp1iWNtZmRduADYrgrj5BY_w6S9XmSu8WVcCLTgE\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "88e0cc35-3105-4369-be5c-bcbdb4b4d8bc", "account_type": "student", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/activate-account?invite=RhvAp1iWNtZmRduADYrgrj5BY_w6S9XmSu8WVcCLTgE"}	sent	1	3	2026-05-18 14:58:53.045897+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.045897+00	2026-05-18 14:59:07.485479+00
39	email	salim.parent@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=VBwQZ2vyH7nTL6yudYFfmm2JJ17QFcgLCvEgKmg2jos\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "96839958-363c-4463-8012-ebb393757ee1", "account_type": "parent", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/activate-account?invite=VBwQZ2vyH7nTL6yudYFfmm2JJ17QFcgLCvEgKmg2jos"}	sent	1	3	2026-05-18 14:58:53.053526+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.053526+00	2026-05-18 14:59:12.527143+00
40	email	akshaydhumda@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=71Ete7sUcNU9s1PfwU3mXacfPBnsLslB_TL_oThJEKo\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "4eb6fc59-d441-49a9-9660-c9cc535c8b3d", "account_type": "student", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/activate-account?invite=71Ete7sUcNU9s1PfwU3mXacfPBnsLslB_TL_oThJEKo"}	sent	1	3	2026-05-18 14:58:53.059981+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.059981+00	2026-05-18 14:59:17.194764+00
41	email	manasiyasahal@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=Gy6UIiZSAtHcBrT0FESj_zQUFH5lp2Ae99z6HXRTkeE\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "1c59d9d3-41e4-4f96-b20f-e13b7712fe82", "account_type": "parent", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/activate-account?invite=Gy6UIiZSAtHcBrT0FESj_zQUFH5lp2Ae99z6HXRTkeE"}	sent	1	3	2026-05-18 14:58:53.066782+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.066782+00	2026-05-18 14:59:22.315165+00
42	email	zoya.student@example.com	Activate your school portal account	Hello Zoya Sheikh,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/activate-account?invite=0DyHpdGv-bYZvUKZZpYXLBWoxQK0GMwbV_2Wn9R-biA\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "2e69e59c-5431-48c2-84ff-fd094ac171b6", "account_type": "student", "student_id": "STU-2025-002", "invite_url": "https://iqraschool.in/activate-account?invite=0DyHpdGv-bYZvUKZZpYXLBWoxQK0GMwbV_2Wn9R-biA"}	sent	1	3	2026-05-18 14:58:53.073687+00	\N	2026-05-18 14:58:55.422893+00	2026-05-18 14:58:53.073687+00	2026-05-18 14:59:27.306298+00
43	email	idontknow999975@gmail.com	Complete your teacher account registration	Hello Meera Shah,\n\nYour school teacher account has been created. Use this secure link to set your password:\nhttps://iqraschool.in/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzc5NzIyMTYwLCJpYXQiOjE3NzkxMTczNjAsImp0aSI6ImQxM2NhMGQyLTEwNTItNGM3Ni05MTJlLTVmNTkwOGFiMWQxNiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.73u8h0NrdjGXb2hoA-tL5wJSPi-y7Uwmxxljwtib7GE\n\nThis link expires in 7 days. If you did not expect this, contact the school office.	{"purpose": "staff_registration", "user_id": 11, "role": "teacher", "invite_url": "https://iqraschool.in/portal/complete-registration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxNzc5NzIyMTYwLCJpYXQiOjE3NzkxMTczNjAsImp0aSI6ImQxM2NhMGQyLTEwNTItNGM3Ni05MTJlLTVmNTkwOGFiMWQxNiIsInB1cnBvc2UiOiJzdGFmZl9yZWdpc3RyYXRpb24iLCJlbWFpbCI6Imlkb250a25vdzk5OTk3NUBnbWFpbC5jb20ifQ.73u8h0NrdjGXb2hoA-tL5wJSPi-y7Uwmxxljwtib7GE"}	sent	1	3	2026-05-18 15:16:00.55554+00	\N	2026-05-18 15:16:09.081319+00	2026-05-18 15:16:00.55554+00	2026-05-18 15:16:09.117753+00
63	email	zoya.student@example.com	Activate your school portal account	Hello Zoya Sheikh,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=VBE88yoDyg63fcxUuOAWbkKSPcTDNV1WpJ7PstLz-Qo\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "2baacd04-a2cd-449b-8a8d-dc786d4e9c22", "account_type": "student", "student_id": "STU-2025-002", "invite_url": "http://localhost/portal/activate-account?invite=VBE88yoDyg63fcxUuOAWbkKSPcTDNV1WpJ7PstLz-Qo"}	sent	1	3	2026-05-28 06:58:09.554629+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.554629+00	2026-05-28 06:58:37.326462+00
64	email	idontknow999975@gmail.com	Activate your school portal account	Hello mohammad imran machhaliya,\n\nUse this secure link to activate your school portal account:\nhttp://localhost/portal/activate-account?invite=YP4dOye6QaZIx04u-n3YywKYbA3p5MXeY2eQAe9M70k\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "75296cfc-80f8-4a07-904b-b6f7a083da6b", "account_type": "student", "student_id": "SMS-2026-001", "invite_url": "http://localhost/portal/activate-account?invite=YP4dOye6QaZIx04u-n3YywKYbA3p5MXeY2eQAe9M70k"}	sent	1	3	2026-05-28 06:58:09.561338+00	\N	2026-05-28 06:58:15.008728+00	2026-05-28 06:58:09.561338+00	2026-05-28 06:58:40.97447+00
44	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=RPA1ezPA-hLcO8v_Hc3jgKHhVCO3XrgZqewKdrw-s4s\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "84dc9573-563b-4786-825f-b63e2aec0232", "account_type": "student", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/portal/activate-account?invite=RPA1ezPA-hLcO8v_Hc3jgKHhVCO3XrgZqewKdrw-s4s"}	sent	1	3	2026-05-18 15:16:33.919615+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:33.919615+00	2026-05-18 15:16:34.403844+00
45	email	sohelmanasiya4@gmail.com	Activate your school portal account	Hello Aarav Patel,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=Ii63zS3z-1FutHPekGf9lkaZnlTE80ZTxpnaSdb2fq8\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "bddb7ac4-be0b-4172-8460-885ecc3ee6bb", "account_type": "parent", "student_id": "OLD-2024-001", "invite_url": "https://iqraschool.in/portal/activate-account?invite=Ii63zS3z-1FutHPekGf9lkaZnlTE80ZTxpnaSdb2fq8"}	sent	1	3	2026-05-18 15:16:33.968078+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:33.968078+00	2026-05-18 15:16:39.080942+00
46	email	kabir.student@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=k_gDfjVo-Z_eRBB_hEjDjQwujz3ko6pl3dyBANxdNtI\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "8a77f4fb-be5d-4cae-a781-2b18405d75d6", "account_type": "student", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/portal/activate-account?invite=k_gDfjVo-Z_eRBB_hEjDjQwujz3ko6pl3dyBANxdNtI"}	sent	1	3	2026-05-18 15:16:33.977786+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:33.977786+00	2026-05-18 15:16:44.274167+00
47	email	salim.parent@example.com	Activate your school portal account	Hello Kabir Ansari,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=OhIWLwiazoIahVxeMzGs7YQWSklRo3A1NAjx9g7lenc\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "603344fa-828f-4c73-9f3e-339ea2a4e449", "account_type": "parent", "student_id": "STU-2025-005", "invite_url": "https://iqraschool.in/portal/activate-account?invite=OhIWLwiazoIahVxeMzGs7YQWSklRo3A1NAjx9g7lenc"}	sent	1	3	2026-05-18 15:16:33.988056+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:33.988056+00	2026-05-18 15:16:48.961109+00
48	email	akshaydhumda@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=REws_dQD4IDGlTIDJKxoizhX8TAQLficK7k7zkwU-ng\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "17cb6b27-e4f7-480b-a595-b416dac2c72e", "account_type": "student", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/portal/activate-account?invite=REws_dQD4IDGlTIDJKxoizhX8TAQLficK7k7zkwU-ng"}	sent	1	3	2026-05-18 15:16:33.995357+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:33.995357+00	2026-05-18 15:16:53.291761+00
49	email	manasiyasahal@gmail.com	Activate your school portal account	Hello Riya chaudhry,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=Zwmco7yc4YfEqn8QJtTTiOpNUrlRT54Nk0Zc4A8Hiu8\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "e575736e-24a6-482c-b369-d48b00cf8f1e", "account_type": "parent", "student_id": "STU-2025-004", "invite_url": "https://iqraschool.in/portal/activate-account?invite=Zwmco7yc4YfEqn8QJtTTiOpNUrlRT54Nk0Zc4A8Hiu8"}	sent	1	3	2026-05-18 15:16:34.00161+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:34.00161+00	2026-05-18 15:16:58.106266+00
50	email	zoya.student@example.com	Activate your school portal account	Hello Zoya Sheikh,\n\nUse this secure link to activate your school portal account:\nhttps://iqraschool.in/portal/activate-account?invite=e2LO0donpAL0ebRYmfaUx635YNx5xrnqyBRciJfkEf4\n\nThe link expires in 7 days. If you did not expect this, contact the school office.	{"invite_id": "16fa466c-5c72-4f96-bf64-a198a3040604", "account_type": "student", "student_id": "STU-2025-002", "invite_url": "https://iqraschool.in/portal/activate-account?invite=e2LO0donpAL0ebRYmfaUx635YNx5xrnqyBRciJfkEf4"}	sent	1	3	2026-05-18 15:16:34.008593+00	\N	2026-05-18 15:16:34.390587+00	2026-05-18 15:16:34.008593+00	2026-05-18 15:17:04.648611+00
\.


--
-- Data for Name: online_payment_orders; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.online_payment_orders (id, student_fee_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, currency, status, created_at, paid_at, failure_reason, student_id, scope, payment_option) FROM stdin;
1	2	order_SmlVR1PPQ5iuVX	\N	\N	500.00	INR	created	2026-05-08 06:07:29.269323+00	\N	\N	1	single_fee	\N
2	3	order_SmlYbd4GXbgZWB	pay_Smla52GCjC1MwH	12c8c9f7deb5ee1b0b46d5841ec259d3d0fcb5f7251e0847d27d7bd78cd75ffa	300.00	INR	paid	2026-05-08 06:10:29.646276+00	2026-05-08 06:12:16.27826+00	\N	1	single_fee	\N
3	2	order_Smlby4LvpvJiCd	pay_Smlc7wL6LPg3L7	830d70c0989a361b013115230ea6c083503e3a2927c710bdbbce8dd53749f9e0	500.00	INR	paid	2026-05-08 06:13:40.541922+00	2026-05-08 06:14:05.941355+00	\N	1	single_fee	\N
5	4	order_Smld5yDe9iabiV	pay_SmldBawBRZQlfw	5353d291ed9c54576436f6f73bb29cdbbe46b7dff136d82acc5361f989d80ed2	600.00	INR	paid	2026-05-08 06:14:44.650061+00	2026-05-08 06:15:05.838716+00	\N	2	single_fee	\N
4	4	order_SmlcWxiqrRI2xq	\N	\N	600.00	INR	failed	2026-05-08 06:14:12.44826+00	\N	Payment amount exceeds outstanding balance ₹0.00	2	single_fee	\N
6	5	order_SmvNU9SBg9EFHC	\N	\N	500.00	INR	created	2026-05-08 15:46:53.504275+00	\N	\N	2	single_fee	\N
7	5	order_SmvO11c5AnDHZs	pay_SmvOEEaRWC9Qy7	d7270cc56305c4848eaec7e450efc5f25bb2053a6afdaec26e14544f9ff1a65e	500.00	INR	paid	2026-05-08 15:47:24.175679+00	2026-05-08 15:47:53.776557+00	\N	2	single_fee	\N
8	6	order_Snx7xypw4ULOUj	pay_Snx8CVQGTjMYKI	53c2ced1231d422e89c31f18cc74526d89c2d99826561e1c8271409892d517c1	300.00	INR	paid	2026-05-11 06:08:34.828283+00	2026-05-11 06:09:04.694861+00	\N	2	single_fee	\N
9	6	order_Sq6Fpn9JDEcqLO	pay_Sq6Fysb3QItv5m	4ad8bcd195d31ef2c451b4c1c3a967d3bbdca16645797d89ec1e83a480a2044d	9700.00	INR	paid	2026-05-16 16:22:17.400163+00	2026-05-16 16:22:46.711624+00	\N	2	single_fee	\N
10	3	order_SrUCweNNmrD9Hg	pay_SrUD75BZxNmcmo	4b7e007fb1c6e69e9843d93a79c7df957159634e93e73febdb8e01e21eb83bf7	9700.00	INR	paid	2026-05-20 04:27:11.207176+00	2026-05-20 04:27:39.716304+00	\N	1	single_fee	\N
11	5	order_SuhQ9jpLlXgSaE	pay_SuhQawjV772dsu	fd865ff3079aa8abae01f993d8f171da4a6ea1cd10689d46c2f5a0880b085baa	500.00	INR	paid	2026-05-28 07:19:41.707996+00	2026-05-28 07:20:26.854622+00	\N	2	single_fee	\N
12	2	order_SuhRIqeeVtQOUM	\N	\N	500.00	INR	created	2026-05-28 07:20:48.941852+00	\N	\N	1	single_fee	\N
\.


--
-- Data for Name: operation_jobs; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.operation_jobs (id, job_type, status, actor_user_id, payload, progress, result, error, created_at, updated_at, completed_at) FROM stdin;
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.otp_verifications (id, activation_request_id, provider, destination_fingerprint, otp_hash, expires_at, verified_at, attempt_count, max_attempts, resend_available_at, created_at) FROM stdin;
1	1	email	f13085f32f780322c5480f22a55533fadbd2c0b6c055123bef5ec5777b535ab3	56bca2694b3c1677e8ef6636c8da6e93bad408a8eb665db5ecd881bf942ddf21	2026-05-07 08:21:06.620184+00	\N	0	5	2026-05-07 08:12:06.620184+00	2026-05-07 08:11:06.604552+00
2	1	email	f13085f32f780322c5480f22a55533fadbd2c0b6c055123bef5ec5777b535ab3	c8e1a95e46ad6872447f050e82f52b9453a43971405ef1b617657c539bc1912a	2026-05-07 08:26:53.479672+00	2026-05-07 08:17:38.679766+00	1	5	2026-05-07 08:17:53.479672+00	2026-05-07 08:16:53.47175+00
3	2	email	f13085f32f780322c5480f22a55533fadbd2c0b6c055123bef5ec5777b535ab3	c15d4f26119289ea2697dc9ce516ecb9634d07fd4607773d8ad74fbe9ef7f428	2026-05-07 08:31:43.394186+00	2026-05-07 08:22:13.002266+00	1	5	2026-05-07 08:22:43.394186+00	2026-05-07 08:21:43.380392+00
4	3	email	313783d0ab343b04c647fb6fbee686e893ddf6e246397c625719a9c706d1fe2f	16ef3a2c84eec33a102ff7dfc17599bb69258e32c4a8a505fb1e563791c658b9	2026-05-07 08:35:54.854065+00	2026-05-07 08:29:12.253391+00	1	5	2026-05-07 08:26:54.854065+00	2026-05-07 08:25:54.835804+00
5	4	email	3184dd42e4aca5a05adc3100fabfb3dc8a94464b49d86fc7a4b9ac31c8a598b1	90f141c77367c67bea34c059184df4dd3b6c1fc14215b3c89ad531efcad85935	2026-05-08 15:53:21.145444+00	\N	0	5	2026-05-08 15:44:21.145444+00	2026-05-08 15:43:21.087972+00
6	5	email	fc8e46f48a6ecc5e43b125545e7dbd8f491522c87bd056f414126ddee7f356dd	b36377a06887ae03b0d78ec13ce1923765579174136c50eb1eec88e177c20bcb	2026-05-28 07:08:52.572249+00	2026-05-28 06:59:15.76195+00	1	5	2026-05-28 06:59:52.572249+00	2026-05-28 06:58:52.522871+00
\.


--
-- Data for Name: portal_activation_invites; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.portal_activation_invites (id, invite_id, token_hash, student_id, account_type, destination, status, created_by_user_id, expires_at, used_at, revoked_at, created_at) FROM stdin;
1	81e3f87f-a3db-470f-932a-3c76bfa63af3	3e31da35289f92f60c2986cc89dc94419d4656b79310a59fd95e73584acf4e83	6	student	aarav.student@example.com	pending	1	2026-05-21 04:12:07.507609+00	\N	\N	2026-05-14 04:12:07.498722+00
2	2f60a5d3-7433-42e6-ab58-e80a76bacc58	ee848fac3b40cfb7da25c3e0f859f527359c719eca9f106d14a9cd8b87e519df	6	parent	rakesh.parent@example.com	pending	1	2026-05-21 04:12:07.54212+00	\N	\N	2026-05-14 04:12:07.540469+00
3	ee3899b7-3b5c-4fef-8bf1-c743d4e79567	547798b4a0f228ff45bff4b80153adcf500bfda1c35e8d476c621f3a5bbd0fbf	6	student	sohelmanasiya4@gmail.com	pending	1	2026-05-21 04:14:02.505138+00	\N	\N	2026-05-14 04:14:02.498648+00
4	2bb0cd37-db3c-4bf3-ad9c-72e79e04569b	2cef2cf3346805bf8e29a6031216bad54dec0240182befdb22d6bbb6cb01320f	6	parent	sohelmanasiya4@gmail.com	pending	1	2026-05-21 04:14:02.527634+00	\N	\N	2026-05-14 04:14:02.525753+00
5	6213c997-4868-4576-b7fb-6f4e2d19d6f2	c8a50eb76ae070f33bc2fc5ca4f1796b8aa6c2618ee981d32af70001c9921c0c	6	student	sohelmanasiya4@gmail.com	pending	1	2026-05-25 14:49:55.034235+00	\N	\N	2026-05-18 14:49:55.028744+00
6	166a4761-89d7-422f-bdd4-dff1695e42e0	a70b29fbce6f0c63a4ad42a9ef68fb343fc28ec25bc50f8195abd6612d620e50	6	parent	sohelmanasiya4@gmail.com	pending	1	2026-05-25 14:49:55.063106+00	\N	\N	2026-05-18 14:49:55.061211+00
7	9a44a0ca-8dc5-46c3-a20c-b30197eaca1f	39a898f455dc222d97a30d3bf93b307545e824475cdb4259f18f78f461420085	5	student	kabir.student@example.com	pending	1	2026-05-25 14:49:55.073824+00	\N	\N	2026-05-18 14:49:55.071719+00
8	51d31246-b9fb-42d0-a1a8-21721cb4acc2	5df5e24d7cc04393ed083d6f135056e5e591c4b0293e9b7f10e1ba6d9b3a06ba	5	parent	salim.parent@example.com	pending	1	2026-05-25 14:49:55.082641+00	\N	\N	2026-05-18 14:49:55.081323+00
9	a2de6de2-fb66-4f41-8408-274e873d89d3	efef82435a5943daac88f1734a6fb1478cd0010d23513b9568f914d8b1ec955f	4	student	akshaydhumda@gmail.com	pending	1	2026-05-25 14:49:55.090221+00	\N	\N	2026-05-18 14:49:55.088606+00
10	e7f908b1-3aaf-4f9a-bed6-62799dc54ee6	80c5da8cbf997ab4839b08aa2e9f6c34835d2340019e24631fb920ccd6c9616d	4	parent	manasiyasahal@gmail.com	pending	1	2026-05-25 14:49:55.097369+00	\N	\N	2026-05-18 14:49:55.096241+00
11	4f17a4ff-7c50-4de2-82a9-84b29e58ed99	f25ae4245bbafae8cb7d14eff0730991af27fb04cde189c9ba85923c840d07e2	2	student	zoya.student@example.com	pending	1	2026-05-25 14:49:55.104876+00	\N	\N	2026-05-18 14:49:55.103629+00
12	898810dd-cf9e-455d-83ca-926bb028346d	ea9fd721b367ae0a617336291913f1ff0ca05617a8baceda5562c0b204fb9aa6	6	student	sohelmanasiya4@gmail.com	pending	1	2026-05-25 14:58:52.999653+00	\N	\N	2026-05-18 14:58:52.990131+00
13	54a34cf2-0657-49f7-8164-2c0e06945066	8b520196acb8f358cc67fa9cb5366893ecdf1acc7e9def8f4bf1333af2741418	6	parent	sohelmanasiya4@gmail.com	pending	1	2026-05-25 14:58:53.036131+00	\N	\N	2026-05-18 14:58:53.034354+00
14	88e0cc35-3105-4369-be5c-bcbdb4b4d8bc	5c49b40829de3465697281fee7f047f611e7bb6dff15e94f00e9b7c1b470c393	5	student	kabir.student@example.com	pending	1	2026-05-25 14:58:53.047678+00	\N	\N	2026-05-18 14:58:53.045897+00
15	96839958-363c-4463-8012-ebb393757ee1	406fa49884bdac0ddf9d8770d88f45d3fa9daf50ad1f43daf39527eb7690724b	5	parent	salim.parent@example.com	pending	1	2026-05-25 14:58:53.054642+00	\N	\N	2026-05-18 14:58:53.053526+00
16	4eb6fc59-d441-49a9-9660-c9cc535c8b3d	29e02c5873d38dcd55f509821f7628d89c8ee89111eaa0ad2950e21c014ff20a	4	student	akshaydhumda@gmail.com	pending	1	2026-05-25 14:58:53.060949+00	\N	\N	2026-05-18 14:58:53.059981+00
17	1c59d9d3-41e4-4f96-b20f-e13b7712fe82	54d270b884cadd27256c959103f84810f0156cb352306dbc8ef54303f44a5a84	4	parent	manasiyasahal@gmail.com	pending	1	2026-05-25 14:58:53.068177+00	\N	\N	2026-05-18 14:58:53.066782+00
18	2e69e59c-5431-48c2-84ff-fd094ac171b6	e6e993dbb03a6f4b98386edf7cf60fc4f8221b2fca5139868fb996aad9f7fb74	2	student	zoya.student@example.com	pending	1	2026-05-25 14:58:53.074779+00	\N	\N	2026-05-18 14:58:53.073687+00
19	84dc9573-563b-4786-825f-b63e2aec0232	335dcba4f17404bfad632068ad12881a03e1595f2ba10834a87804850d64c1e7	6	student	sohelmanasiya4@gmail.com	pending	1	2026-05-25 15:16:33.935212+00	\N	\N	2026-05-18 15:16:33.919615+00
20	bddb7ac4-be0b-4172-8460-885ecc3ee6bb	8dc46b36af061858dc044991c784f7ce11c22b47406942f83e84f8ad03a6966a	6	parent	sohelmanasiya4@gmail.com	pending	1	2026-05-25 15:16:33.969337+00	\N	\N	2026-05-18 15:16:33.968078+00
21	8a77f4fb-be5d-4cae-a781-2b18405d75d6	751032d2563af994c67438d7918e47138eda194407db56b18f00724f00e96551	5	student	kabir.student@example.com	pending	1	2026-05-25 15:16:33.981354+00	\N	\N	2026-05-18 15:16:33.977786+00
22	603344fa-828f-4c73-9f3e-339ea2a4e449	d843091a6b9d14682738316d34267e1dc24667c7e68004c4a669477fa6bde055	5	parent	salim.parent@example.com	pending	1	2026-05-25 15:16:33.989511+00	\N	\N	2026-05-18 15:16:33.988056+00
23	17cb6b27-e4f7-480b-a595-b416dac2c72e	a327cbfb0f430c5871e1c4abbe6a1b37b9f13da7a6b16ac13a93d851bc621cd4	4	student	akshaydhumda@gmail.com	pending	1	2026-05-25 15:16:33.996538+00	\N	\N	2026-05-18 15:16:33.995357+00
24	e575736e-24a6-482c-b369-d48b00cf8f1e	17ff09e9a57eb90007dc96eebbf380bc3d295606bd651be9eeab0e7424740b14	4	parent	manasiyasahal@gmail.com	pending	1	2026-05-25 15:16:34.002779+00	\N	\N	2026-05-18 15:16:34.00161+00
25	16fa466c-5c72-4f96-bf64-a198a3040604	8d52d9bb94f3b4356c7e49ec94e7dc7da98025372d2a99e381ffa4e459d0dea0	2	student	zoya.student@example.com	pending	1	2026-05-25 15:16:34.009771+00	\N	\N	2026-05-18 15:16:34.008593+00
26	d03650a2-1693-4efa-aea6-5f335db8dbc2	d85276cb5b980218680cb8e354431e66d8db2e13988de696b92f774b4cdd2e61	6	student	sohelmanasiya4@gmail.com	pending	1	2026-06-04 06:58:09.444591+00	\N	\N	2026-05-28 06:58:09.436032+00
27	7eaa2601-84bd-49fb-8637-9e81b0adf3f1	115878ccf923ec8d34b09166070248183e09af15e1a050a4d358a9aa88a9f154	6	parent	sohelmanasiya4@gmail.com	pending	1	2026-06-04 06:58:09.502416+00	\N	\N	2026-05-28 06:58:09.500751+00
28	e3aaf45f-4063-4436-940a-476b10133e99	c822966bc42c73fd50b9cc9d360dab15b55167df49463fb7189b14c6a94ff023	5	student	kabir.student@example.com	pending	1	2026-06-04 06:58:09.517995+00	\N	\N	2026-05-28 06:58:09.516672+00
29	83e537d3-482a-4547-9297-c4629629af5f	bfdf5bd1dcd6a6175d9e94749285ec0ed22a89ecc3fdcc6bb30311187a772a81	5	parent	salim.parent@example.com	pending	1	2026-06-04 06:58:09.52952+00	\N	\N	2026-05-28 06:58:09.528404+00
30	968b201a-f7ec-4d16-a20e-ab8b83895b82	ceab9e1d2802873f170e128a50afe56b7a4c10fec82abc98ef93d7665bc824c9	4	student	akshaydhumda@gmail.com	pending	1	2026-06-04 06:58:09.540028+00	\N	\N	2026-05-28 06:58:09.538798+00
31	ce41643a-b5ff-48e7-ab28-b4c4870e3ec7	a73a41b3afb1af2b28c0cb47c236601e714278d5ba63684c9182147f51c00e3b	4	parent	manasiyasahal@gmail.com	pending	1	2026-06-04 06:58:09.548486+00	\N	\N	2026-05-28 06:58:09.546593+00
32	2baacd04-a2cd-449b-8a8d-dc786d4e9c22	cc9d3e00b12bff6bd445cbbb3cb58fab5032a889de9fa726bcbf280d91c0210a	2	student	zoya.student@example.com	pending	1	2026-06-04 06:58:09.555658+00	\N	\N	2026-05-28 06:58:09.554629+00
34	9cde64b3-9999-49c9-a533-0f314547e547	56642b78317d07fdbc57de713f551bd5196342a7647acfc552dcfd24984c1050	7	parent	idontknow999975@gmail.com	pending	1	2026-06-04 06:58:09.569418+00	\N	\N	2026-05-28 06:58:09.568392+00
35	040e7879-d456-4e7b-8da2-e99d9228dc05	192686e5a61f22b6dffa8efdc6bb472286ec77b428d65cc5ae627c31494f4d37	7	student	idontknow999975@gmail.com	pending	1	2026-06-04 06:58:48.265764+00	\N	\N	2026-05-28 06:58:48.243378+00
33	75296cfc-80f8-4a07-904b-b6f7a083da6b	40f81a6085df01c6673c91668e33b2c69a329d5f3c1648005dd75884072c0843	7	student	idontknow999975@gmail.com	used	1	2026-06-04 06:58:09.562252+00	2026-05-28 06:58:52.507588+00	\N	2026-05-28 06:58:09.561338+00
\.


--
-- Data for Name: profile_correction_requests; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.profile_correction_requests (id, student_id, requested_by_user_id, field_name, current_value, requested_value, reason, status, admin_note, resolved_by_user_id, resolved_at, created_at) FROM stdin;
1	1	7	address	12 Gandhi Nagar, Palanpur	18 Gandhi Nagar, Palanpur	\N	rejected	\N	1	2026-05-14 04:16:20.017453+00	2026-05-14 04:15:57.337145+00
2	1	7	address	12 Gandhi Nagar, Palanpur	18 Gandhi Nagar, Palanpur	\N	approved	\N	1	2026-05-14 04:17:10.127813+00	2026-05-14 04:16:54.157421+00
\.


--
-- Data for Name: report_cards; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.report_cards (id, enrollment_id, exam_id, pdf_path, is_locked, generated_at, locked_at) FROM stdin;
1	1	6	/api/v1/portal/me/marksheet/6?student_id=1	f	2026-05-07 14:12:40.715125+00	\N
\.


--
-- Data for Name: student_activation_requests; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.student_activation_requests (id, activation_id, student_id, account_type, destination, destination_fingerprint, status, verified_at, completed_at, expires_at, resend_count, locked_until, request_ip, user_agent, created_at, updated_at) FROM stdin;
1	e5314ba1-1b3b-4405-be07-6be83c047822	1	student	manasiyasahal98@gmail.com	f13085f32f780322c5480f22a55533fadbd2c0b6c055123bef5ec5777b535ab3	completed	2026-05-07 08:17:38.679766+00	2026-05-07 08:17:50.228288+00	2026-05-07 08:41:06.596358+00	2	\N	127.0.0.1	Python-urllib/3.11	2026-05-07 08:11:06.604552+00	2026-05-07 08:17:50.237558+00
2	05b62c63-5cba-425a-946b-6dff12c5270d	1	parent	manasiyasahal98@gmail.com	f13085f32f780322c5480f22a55533fadbd2c0b6c055123bef5ec5777b535ab3	verified	2026-05-07 08:22:13.002266+00	\N	2026-05-07 08:51:43.374531+00	1	\N	172.18.0.4	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15	2026-05-07 08:21:43.380392+00	2026-05-07 08:22:13.008065+00
3	9b2dfdc1-3e3a-4ece-a558-e5a932fdbf89	1	parent	vt8615154@gmail.com	313783d0ab343b04c647fb6fbee686e893ddf6e246397c625719a9c706d1fe2f	completed	2026-05-07 08:29:12.253391+00	2026-05-07 08:29:22.360031+00	2026-05-07 08:55:54.822807+00	1	\N	172.18.0.4	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15	2026-05-07 08:25:54.835804+00	2026-05-07 08:29:22.361508+00
4	2b9f9faf-0ac8-48c3-a876-f519ee3207e0	4	student	akshaydhumda@gmail.com	3184dd42e4aca5a05adc3100fabfb3dc8a94464b49d86fc7a4b9ac31c8a598b1	pending	\N	\N	2026-05-08 16:13:21.081848+00	1	\N	172.18.0.4	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15	2026-05-08 15:43:21.087972+00	2026-05-08 15:43:21.087972+00
5	3230343a-e82c-49ac-86b7-f69a647df0c8	7	student	idontknow999975@gmail.com	fc8e46f48a6ecc5e43b125545e7dbd8f491522c87bd056f414126ddee7f356dd	verified	2026-05-28 06:59:15.76195+00	\N	2026-05-28 07:28:52.534423+00	1	\N	172.18.0.4	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15	2026-05-28 06:58:52.522871+00	2026-05-28 06:59:15.769194+00
\.


--
-- Data for Name: student_fees; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.student_fees (id, student_id, fee_structure_id, concession, net_amount, academic_year_id, invoice_type, source_invoice_id, enrollment_id) FROM stdin;
1	1	4	0.00	1200.00	1	regular	\N	1
4	2	4	0.00	1200.00	1	regular	\N	2
7	3	4	0.00	1200.00	1	regular	\N	3
10	4	1	0.00	900.00	1	regular	\N	4
11	4	2	0.00	350.00	1	regular	\N	4
12	4	3	0.00	250.00	1	regular	\N	4
13	5	7	0.00	1500.00	1	regular	\N	5
14	5	8	0.00	700.00	1	regular	\N	5
15	5	9	0.00	400.00	1	regular	\N	5
3	1	6	0.00	10000.00	1	regular	\N	1
6	2	6	0.00	10000.00	1	regular	\N	2
9	3	6	0.00	10000.00	1	regular	\N	3
16	6	4	0.00	1200.00	1	regular	\N	6
18	6	6	0.00	10000.00	1	regular	\N	6
2	1	5	0.00	1000.00	1	regular	\N	1
5	2	5	0.00	1000.00	1	regular	\N	2
8	3	5	0.00	1000.00	1	regular	\N	3
17	6	5	0.00	1000.00	1	regular	\N	6
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.students (id, student_id, gr_number, name_en, name_gu, dob, gender, class_id, roll_number, father_name, mother_name, contact, address, category, aadhar_last4, admission_date, academic_year_id, status, photo_path, created_at, student_user_id, parent_user_id, reason_for_leaving, previous_school, student_email, student_phone, guardian_email, guardian_phone, branch_id) FROM stdin;
3	STU-2025-003	GR2025003	Dhruv Sharma	ધ્રુવ શર્મા	2012-01-10	M	2	3	Vikram Sharma	Priya Sharma	9876543203	8 Station Road, Palanpur	GEN	2303	2025-06-01	1	Active	\N	2026-05-07 08:10:42.900544+00	4	5	\N	\N	linked.student@example.com	9876543203	linked.parent@example.com	9876543203	\N
5	STU-2025-005	GR2025005	Kabir Ansari	કબીર અન્સારી	2010-11-30	M	3	1	Salim Ansari	Noor Ansari	9876543205	67 Bhagat Singh Nagar, Palanpur	GEN	2301	2025-06-01	1	Active	\N	2026-05-07 08:10:42.900544+00	\N	\N	\N	\N	kabir.student@example.com	9876543205	salim.parent@example.com	9876543205	\N
2	STU-2025-002	GR2025002	Zoya Sheikh	ઝોયા શેખ	2012-07-22	F	2	2	Imran Sheikh	Fatima Sheikh	9876543202	45 Nehru Road, Palanpur	GEN	\N	2025-06-01	1	Active	\N	2026-05-07 08:10:42.900544+00	\N	7	\N	\N	zoya.student@example.com	9876543202	vt8615154@gmail.com	9876543202	\N
4	STU-2025-004	GR2025004	Riya chaudhry	રિયા મોદી	2014-06-12	F	1	1	Ajay Modi	Kavita Modi	9876543204	10 MG Road, Palanpur	GEN	\N	2025-06-01	1	Active	\N	2026-05-07 08:10:42.900544+00	\N	\N	\N	\N	akshaydhumda@gmail.com	9876543204	manasiyasahal@gmail.com	9876543204	\N
6	OLD-2024-001	GR2024001	Aarav Patel	આરવ પટેલ	2013-05-12	M	2	1	Rakesh Patel	Pooja Patel	9876543210	Palanpur, Gujarat	GEN	1234	2024-06-01	1	Active	\N	2026-05-10 04:30:38.71262+00	\N	\N	\N	Iqra Primary School	sohelmanasiya4@gmail.com	9876543210	sohelmanasiya4@gmail.com	9876543210	\N
1	STU-2025-001	GR2025001	Aryan Patel	આર્યન પટેલ	2012-04-15	M	2	1	Ramesh Patel	Sunita Patel	9876543201	18 Gandhi Nagar, Palanpur	GEN	\N	2025-06-01	1	Active	\N	2026-05-07 08:10:42.900544+00	6	7	\N	\N	manasiyasahal98@gmail.com	9876543201	vt8615154@gmail.com	9876543201	\N
7	SMS-2026-001	90	mohammad imran machhaliya	in gujarati	2010-06-18	M	3	21	imranbhai machhaliya	arefaben machhaliya 	9999999999		GEN	9009	2026-05-28	1	Active	\N	2026-05-28 06:54:47.031984+00	\N	\N	\N	\N	idontknow999975@gmail.com	9999999999	idontknow999975@gmail.com	9999999999	\N
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.subjects (id, name, class_id, max_theory, max_practical, subject_type, is_active, code, is_exam_eligible, passing_marks) FROM stdin;
1	English	1	80	20	Theory	t	ENG	t	33
2	Gujarati	1	80	20	Theory	t	GUJ	t	33
3	Mathematics	1	100	0	Theory	t	MAT	t	33
4	Science	1	80	20	Theory	t	SCI	t	33
5	Social Studies	1	100	0	Theory	t	SST	t	33
6	English	2	80	20	Theory	t	ENG	t	33
7	Gujarati	2	80	20	Theory	t	GUJ	t	33
8	Mathematics	2	100	0	Theory	t	MAT	t	33
9	Science	2	80	20	Theory	t	SCI	t	33
10	Social Studies	2	100	0	Theory	t	SST	t	33
11	English	3	80	20	Theory	t	ENG	t	33
12	Gujarati	3	80	20	Theory	t	GUJ	t	33
13	Mathematics	3	100	0	Theory	t	MAT	t	33
14	Science	3	80	20	Theory	t	SCI	t	33
15	Social Studies	3	100	0	Theory	t	SST	t	33
16	Hindi	3	100	0	Theory	t	\N	t	\N
17	Science & Technology	3	100	25	Theory+Practical	t	\N	t	\N
18	Social Science	3	100	0	Theory	t	\N	t	\N
19	Sanskrit	3	100	0	Theory	t	\N	t	\N
20	English	7	100	0	Theory	t	\N	t	\N
21	Hindi	7	100	0	Theory	t	\N	t	\N
22	Mathematics	7	100	0	Theory	t	\N	t	\N
23	Drawing	7	100	0	Theory	t	\N	t	\N
24	Gujarati	12	100	0	Theory	t	\N	t	\N
25	Hindi	12	100	0	Theory	t	\N	t	\N
26	English	12	100	0	Theory	t	\N	t	\N
27	Mathematics	12	100	0	Theory	t	\N	t	\N
28	EVS	12	100	0	Theory	t	\N	t	\N
29	Drawing	12	100	0	Theory	t	\N	t	\N
30	Gujarati	11	100	0	Theory	t	\N	t	\N
31	Hindi	11	100	0	Theory	t	\N	t	\N
32	English	11	100	0	Theory	t	\N	t	\N
33	Mathematics	11	100	0	Theory	t	\N	t	\N
34	EVS	11	100	0	Theory	t	\N	t	\N
\.


--
-- Data for Name: teacher_class_assignments; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.teacher_class_assignments (id, teacher_id, class_id, academic_year_id, subject_id, created_at) FROM stdin;
1	2	2	1	\N	2026-05-07 08:10:42.900544+00
2	3	2	1	8	2026-05-07 08:10:42.900544+00
3	14	1	1	\N	2026-05-27 04:15:43.553377+00
\.


--
-- Data for Name: token_blocklist; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.token_blocklist (id, jti, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: transfer_certificates; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.transfer_certificates (id, tc_number, student_id, reason, conduct, issued_at) FROM stdin;
1	TC-2026-0001	7	Parent's Request	Good	2026-05-28 06:55:10.647821+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sms_user
--

COPY public.users (id, name, email, password_hash, role, is_active, branch_id, two_factor_enabled, two_factor_channel, two_factor_destination) FROM stdin;
1	School Admin	admin@iqraschool.in	$2b$12$7BQnVxJUChQrBxfD6ziPoun5cZ.J4N.JzXwF67tmD0YyADyUx3gdi	admin	t	\N	f	\N	\N
2	Meera Shah	teacher7@iqraschool.in	$2b$12$EWtaxIuM1BUIAURYOH04oeNUmnvD6zhcKT2yWBHdC2n1aUJTmwsmC	teacher	t	\N	f	\N	\N
3	Rohan Patel	math.teacher@iqraschool.in	$2b$12$.OYUzOCvEltUAxNt3.k8p.zrQgXl9YYxYwjEP/UeADOO.U5MZVyZq	teacher	t	\N	f	\N	\N
4	Linked Demo Student	linked.student@example.com	$2b$12$Pk5.T12r2Bd9HL3aEAPsAO0.0cndrfSl5.qD4UDE3qhi6dJs.mGky	student	t	\N	f	\N	\N
5	Linked Demo Parent	linked.parent@example.com	$2b$12$O3V/6coZjD927OgNc4eZNuxURGeBwgNFb8PPnNZhc0o7iiAHpyjNi	parent	t	\N	f	\N	\N
6	Aryan Patel	manasiyasahal98@gmail.com	$2b$12$lYv.szwKfIPp1CQVYbSk/OJSaC5l0xUFB2f9AUU/gYxMtzCOkEKay	student	t	\N	f	\N	\N
7	Ramesh Patel	vt8615154@gmail.com	$2b$12$2oKSUKwo9DbpazGCBBSyjObMgxunlbPdYaG2DFrWZbrd0ZgwSg4IG	parent	t	\N	f	\N	\N
8	mera 	sohelmanasiya4@gmail.com	$2b$12$FZ7c4Opkln66WSw.YHH3Hu4WVt.9RNwK59j6pfX/ulsEABKT.kA7O	teacher	f	\N	f	\N	\N
11	Meera Shah	idontknow999975@gmail.com	$2b$12$jTsyUmar0e0A1xY5dgY2DulLQs96sf.aoxZ239sD0tpQptycbSUZK	teacher	f	\N	f	\N	\N
14	sahal	msgoatfarm4@gmail.com	$2b$12$Mo/Qzzt9.oQ732Q1.Wlz.uNxIKkBn.YdA6vHaZlgZrdVeu0O5YikG	teacher	t	\N	f	\N	\N
\.


--
-- Name: academic_calendar_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.academic_calendar_id_seq', 1, true);


--
-- Name: academic_years_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.academic_years_id_seq', 2, true);


--
-- Name: admin_login_otp_challenges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.admin_login_otp_challenges_id_seq', 1, false);


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.attendance_id_seq', 25, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 12, true);


--
-- Name: auth_refresh_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.auth_refresh_sessions_id_seq', 63, true);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.branches_id_seq', 1, false);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.classes_id_seq', 16, true);


--
-- Name: data_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.data_audit_logs_id_seq', 9, true);


--
-- Name: enrollments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.enrollments_id_seq', 7, true);


--
-- Name: exam_subject_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.exam_subject_configs_id_seq', 1, false);


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.exams_id_seq', 12, true);


--
-- Name: fee_heads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.fee_heads_id_seq', 3, true);


--
-- Name: fee_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.fee_payments_id_seq', 10, true);


--
-- Name: fee_structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.fee_structures_id_seq', 9, true);


--
-- Name: import_batch_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.import_batch_items_id_seq', 1, true);


--
-- Name: import_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.import_batches_id_seq', 1, true);


--
-- Name: marks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.marks_id_seq', 25, true);


--
-- Name: notification_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.notification_log_id_seq', 21, true);


--
-- Name: notification_outbox_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.notification_outbox_id_seq', 68, true);


--
-- Name: online_payment_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.online_payment_orders_id_seq', 12, true);


--
-- Name: operation_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.operation_jobs_id_seq', 1, false);


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.otp_verifications_id_seq', 6, true);


--
-- Name: portal_activation_invites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.portal_activation_invites_id_seq', 35, true);


--
-- Name: profile_correction_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.profile_correction_requests_id_seq', 2, true);


--
-- Name: receipt_number_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.receipt_number_seq', 8, true);


--
-- Name: report_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.report_cards_id_seq', 1, true);


--
-- Name: student_activation_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.student_activation_requests_id_seq', 5, true);


--
-- Name: student_fees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.student_fees_id_seq', 18, true);


--
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.students_id_seq', 7, true);


--
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.subjects_id_seq', 34, true);


--
-- Name: tc_number_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.tc_number_seq', 1, true);


--
-- Name: teacher_class_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.teacher_class_assignments_id_seq', 3, true);


--
-- Name: token_blocklist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.token_blocklist_id_seq', 9, true);


--
-- Name: transfer_certificates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.transfer_certificates_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sms_user
--

SELECT pg_catalog.setval('public.users_id_seq', 15, true);


--
-- Name: academic_calendar academic_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_calendar
    ADD CONSTRAINT academic_calendar_pkey PRIMARY KEY (id);


--
-- Name: academic_years academic_years_label_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_label_key UNIQUE (label);


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: admin_login_otp_challenges admin_login_otp_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.admin_login_otp_challenges
    ADD CONSTRAINT admin_login_otp_challenges_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_refresh_sessions auth_refresh_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.auth_refresh_sessions
    ADD CONSTRAINT auth_refresh_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_refresh_sessions auth_refresh_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.auth_refresh_sessions
    ADD CONSTRAINT auth_refresh_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: data_audit_logs data_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.data_audit_logs
    ADD CONSTRAINT data_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: exam_subject_configs exam_subject_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exam_subject_configs
    ADD CONSTRAINT exam_subject_configs_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: fee_heads fee_heads_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_heads
    ADD CONSTRAINT fee_heads_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_receipt_number_key UNIQUE (receipt_number);


--
-- Name: fee_structures fee_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);


--
-- Name: import_batch_items import_batch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batch_items
    ADD CONSTRAINT import_batch_items_pkey PRIMARY KEY (id);


--
-- Name: import_batches import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);


--
-- Name: marks marks_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_pkey PRIMARY KEY (id);


--
-- Name: notification_log notification_log_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: notification_log notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: online_payment_orders online_payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.online_payment_orders
    ADD CONSTRAINT online_payment_orders_pkey PRIMARY KEY (id);


--
-- Name: online_payment_orders online_payment_orders_razorpay_order_id_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.online_payment_orders
    ADD CONSTRAINT online_payment_orders_razorpay_order_id_key UNIQUE (razorpay_order_id);


--
-- Name: operation_jobs operation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.operation_jobs
    ADD CONSTRAINT operation_jobs_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: portal_activation_invites portal_activation_invites_invite_id_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites
    ADD CONSTRAINT portal_activation_invites_invite_id_key UNIQUE (invite_id);


--
-- Name: portal_activation_invites portal_activation_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites
    ADD CONSTRAINT portal_activation_invites_pkey PRIMARY KEY (id);


--
-- Name: portal_activation_invites portal_activation_invites_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites
    ADD CONSTRAINT portal_activation_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: profile_correction_requests profile_correction_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.profile_correction_requests
    ADD CONSTRAINT profile_correction_requests_pkey PRIMARY KEY (id);


--
-- Name: report_cards report_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.report_cards
    ADD CONSTRAINT report_cards_pkey PRIMARY KEY (id);


--
-- Name: student_activation_requests student_activation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_activation_requests
    ADD CONSTRAINT student_activation_requests_pkey PRIMARY KEY (id);


--
-- Name: student_fees student_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_student_id_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_id_key UNIQUE (student_id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: teacher_class_assignments teacher_class_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT teacher_class_assignments_pkey PRIMARY KEY (id);


--
-- Name: token_blocklist token_blocklist_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.token_blocklist
    ADD CONSTRAINT token_blocklist_pkey PRIMARY KEY (id);


--
-- Name: transfer_certificates transfer_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.transfer_certificates
    ADD CONSTRAINT transfer_certificates_pkey PRIMARY KEY (id);


--
-- Name: attendance uq_attendance_enrollment_date; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT uq_attendance_enrollment_date UNIQUE (enrollment_id, date);


--
-- Name: attendance uq_attendance_student_class_date; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT uq_attendance_student_class_date UNIQUE (student_id, class_id, date);


--
-- Name: enrollments uq_enrollment_student_year; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT uq_enrollment_student_year UNIQUE (student_id, academic_year_id);


--
-- Name: exam_subject_configs uq_exam_subject_config; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exam_subject_configs
    ADD CONSTRAINT uq_exam_subject_config UNIQUE (exam_id, subject_id);


--
-- Name: fee_structures uq_fee_structure_class_head_year; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT uq_fee_structure_class_head_year UNIQUE (class_id, fee_head_id, academic_year_id);


--
-- Name: marks uq_mark_enrollment_subject_exam; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT uq_mark_enrollment_subject_exam UNIQUE (enrollment_id, subject_id, exam_id);


--
-- Name: marks uq_mark_student_subject_exam; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT uq_mark_student_subject_exam UNIQUE (student_id, subject_id, exam_id);


--
-- Name: report_cards uq_report_card_enrollment_exam; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.report_cards
    ADD CONSTRAINT uq_report_card_enrollment_exam UNIQUE (enrollment_id, exam_id);


--
-- Name: students uq_students_student_user_id; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT uq_students_student_user_id UNIQUE (student_user_id);


--
-- Name: teacher_class_assignments uq_teacher_class_year_subject; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT uq_teacher_class_year_subject UNIQUE (teacher_id, class_id, academic_year_id, subject_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_attendance_class_date; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX idx_attendance_class_date ON public.attendance USING btree (class_id, date);


--
-- Name: idx_fee_payments_date; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX idx_fee_payments_date ON public.fee_payments USING btree (payment_date);


--
-- Name: idx_marks_exam_student; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX idx_marks_exam_student ON public.marks USING btree (exam_id, student_id);


--
-- Name: idx_student_fees_student; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX idx_student_fees_student ON public.student_fees USING btree (student_id);


--
-- Name: idx_students_class_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX idx_students_class_year ON public.students USING btree (class_id, academic_year_id);


--
-- Name: ix_academic_years_branch_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_academic_years_branch_id ON public.academic_years USING btree (branch_id);


--
-- Name: ix_admin_login_otp_challenges_challenge_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_admin_login_otp_challenges_challenge_id ON public.admin_login_otp_challenges USING btree (challenge_id);


--
-- Name: ix_admin_login_otp_challenges_expires_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_admin_login_otp_challenges_expires_at ON public.admin_login_otp_challenges USING btree (expires_at);


--
-- Name: ix_admin_login_otp_challenges_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_admin_login_otp_challenges_user_id ON public.admin_login_otp_challenges USING btree (user_id);


--
-- Name: ix_attendance_enrollment_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_attendance_enrollment_id ON public.attendance USING btree (enrollment_id);


--
-- Name: ix_audit_logs_operation; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_audit_logs_operation ON public.audit_logs USING btree (operation);


--
-- Name: ix_audit_logs_performed_by; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_audit_logs_performed_by ON public.audit_logs USING btree (performed_by);


--
-- Name: ix_audit_logs_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_audit_logs_year ON public.audit_logs USING btree (academic_year_id);


--
-- Name: ix_auth_refresh_sessions_expires_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_auth_refresh_sessions_expires_at ON public.auth_refresh_sessions USING btree (expires_at);


--
-- Name: ix_auth_refresh_sessions_family_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_auth_refresh_sessions_family_id ON public.auth_refresh_sessions USING btree (family_id);


--
-- Name: ix_auth_refresh_sessions_token_hash; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_auth_refresh_sessions_token_hash ON public.auth_refresh_sessions USING btree (token_hash);


--
-- Name: ix_auth_refresh_sessions_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_auth_refresh_sessions_user_id ON public.auth_refresh_sessions USING btree (user_id);


--
-- Name: ix_calendar_year_dates; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_calendar_year_dates ON public.academic_calendar USING btree (academic_year_id, start_date, end_date);


--
-- Name: ix_classes_branch_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_classes_branch_id ON public.classes USING btree (branch_id);


--
-- Name: ix_data_audit_logs_action; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_data_audit_logs_action ON public.data_audit_logs USING btree (action);


--
-- Name: ix_data_audit_logs_created_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_data_audit_logs_created_at ON public.data_audit_logs USING btree (created_at);


--
-- Name: ix_data_audit_logs_record_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_data_audit_logs_record_id ON public.data_audit_logs USING btree (record_id);


--
-- Name: ix_data_audit_logs_table_name; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_data_audit_logs_table_name ON public.data_audit_logs USING btree (table_name);


--
-- Name: ix_data_audit_logs_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_data_audit_logs_user_id ON public.data_audit_logs USING btree (user_id);


--
-- Name: ix_enrollments_class_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_enrollments_class_year ON public.enrollments USING btree (class_id, academic_year_id);


--
-- Name: ix_enrollments_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_enrollments_status ON public.enrollments USING btree (status);


--
-- Name: ix_enrollments_student; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_enrollments_student ON public.enrollments USING btree (student_id);


--
-- Name: ix_enrollments_year_class; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_enrollments_year_class ON public.enrollments USING btree (academic_year_id, class_id);


--
-- Name: ix_exam_subject_configs_exam_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_exam_subject_configs_exam_id ON public.exam_subject_configs USING btree (exam_id);


--
-- Name: ix_fee_payments_online_order_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_fee_payments_online_order_id ON public.fee_payments USING btree (online_order_id);


--
-- Name: ix_fee_payments_payment_date; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_fee_payments_payment_date ON public.fee_payments USING btree (payment_date);


--
-- Name: ix_fee_structures_class_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_fee_structures_class_year ON public.fee_structures USING btree (class_id, academic_year_id);


--
-- Name: ix_import_batch_items_entity_type; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_import_batch_items_entity_type ON public.import_batch_items USING btree (entity_type);


--
-- Name: ix_import_batch_items_import_batch_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_import_batch_items_import_batch_id ON public.import_batch_items USING btree (import_batch_id);


--
-- Name: ix_import_batches_entity_type; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_import_batches_entity_type ON public.import_batches USING btree (entity_type);


--
-- Name: ix_import_batches_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_import_batches_status ON public.import_batches USING btree (status);


--
-- Name: ix_marks_enrollment_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_marks_enrollment_id ON public.marks USING btree (enrollment_id);


--
-- Name: ix_marks_student_exam; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_marks_student_exam ON public.marks USING btree (student_id, exam_id);


--
-- Name: ix_notification_log_channel; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_log_channel ON public.notification_log USING btree (channel);


--
-- Name: ix_notification_log_idempotency_key; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_notification_log_idempotency_key ON public.notification_log USING btree (idempotency_key);


--
-- Name: ix_notification_log_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_log_status ON public.notification_log USING btree (status);


--
-- Name: ix_notification_log_type; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_log_type ON public.notification_log USING btree (notification_type);


--
-- Name: ix_notification_outbox_next_attempt_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_outbox_next_attempt_at ON public.notification_outbox USING btree (next_attempt_at);


--
-- Name: ix_notification_outbox_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_outbox_status ON public.notification_outbox USING btree (status);


--
-- Name: ix_online_payment_orders_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_online_payment_orders_status ON public.online_payment_orders USING btree (status);


--
-- Name: ix_online_payment_orders_student_fee_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_online_payment_orders_student_fee_id ON public.online_payment_orders USING btree (student_fee_id);


--
-- Name: ix_online_payment_orders_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_online_payment_orders_student_id ON public.online_payment_orders USING btree (student_id);


--
-- Name: ix_operation_jobs_actor_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_operation_jobs_actor_user_id ON public.operation_jobs USING btree (actor_user_id);


--
-- Name: ix_operation_jobs_job_type; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_operation_jobs_job_type ON public.operation_jobs USING btree (job_type);


--
-- Name: ix_operation_jobs_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_operation_jobs_status ON public.operation_jobs USING btree (status);


--
-- Name: ix_otp_verifications_activation_request_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_otp_verifications_activation_request_id ON public.otp_verifications USING btree (activation_request_id);


--
-- Name: ix_otp_verifications_destination_fingerprint; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_otp_verifications_destination_fingerprint ON public.otp_verifications USING btree (destination_fingerprint);


--
-- Name: ix_otp_verifications_expires_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_otp_verifications_expires_at ON public.otp_verifications USING btree (expires_at);


--
-- Name: ix_portal_activation_invites_created_by_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_created_by_user_id ON public.portal_activation_invites USING btree (created_by_user_id);


--
-- Name: ix_portal_activation_invites_expires_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_expires_at ON public.portal_activation_invites USING btree (expires_at);


--
-- Name: ix_portal_activation_invites_invite_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_invite_id ON public.portal_activation_invites USING btree (invite_id);


--
-- Name: ix_portal_activation_invites_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_status ON public.portal_activation_invites USING btree (status);


--
-- Name: ix_portal_activation_invites_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_student_id ON public.portal_activation_invites USING btree (student_id);


--
-- Name: ix_portal_activation_invites_token_hash; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_portal_activation_invites_token_hash ON public.portal_activation_invites USING btree (token_hash);


--
-- Name: ix_profile_correction_requests_requested_by_user_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_profile_correction_requests_requested_by_user_id ON public.profile_correction_requests USING btree (requested_by_user_id);


--
-- Name: ix_profile_correction_requests_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_profile_correction_requests_status ON public.profile_correction_requests USING btree (status);


--
-- Name: ix_profile_correction_requests_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_profile_correction_requests_student_id ON public.profile_correction_requests USING btree (student_id);


--
-- Name: ix_student_activation_requests_activation_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_student_activation_requests_activation_id ON public.student_activation_requests USING btree (activation_id);


--
-- Name: ix_student_activation_requests_destination_fingerprint; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_activation_requests_destination_fingerprint ON public.student_activation_requests USING btree (destination_fingerprint);


--
-- Name: ix_student_activation_requests_expires_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_activation_requests_expires_at ON public.student_activation_requests USING btree (expires_at);


--
-- Name: ix_student_activation_requests_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_activation_requests_student_id ON public.student_activation_requests USING btree (student_id);


--
-- Name: ix_student_fees_academic_year_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_fees_academic_year_id ON public.student_fees USING btree (academic_year_id);


--
-- Name: ix_student_fees_enrollment_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_fees_enrollment_id ON public.student_fees USING btree (enrollment_id);


--
-- Name: ix_student_fees_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_fees_student_id ON public.student_fees USING btree (student_id);


--
-- Name: ix_student_fees_student_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_fees_student_year ON public.student_fees USING btree (student_id, academic_year_id);


--
-- Name: ix_students_academic_year_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_academic_year_id ON public.students USING btree (academic_year_id);


--
-- Name: ix_students_branch_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_branch_id ON public.students USING btree (branch_id);


--
-- Name: ix_students_class_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_class_id ON public.students USING btree (class_id);


--
-- Name: ix_students_gr_number; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_gr_number ON public.students USING btree (gr_number);


--
-- Name: ix_students_guardian_email; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_guardian_email ON public.students USING btree (guardian_email);


--
-- Name: ix_students_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_students_status ON public.students USING btree (status);


--
-- Name: ix_students_student_email; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_students_student_email ON public.students USING btree (student_email);


--
-- Name: ix_token_blocklist_jti; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_token_blocklist_jti ON public.token_blocklist USING btree (jti);


--
-- Name: ix_transfer_certificates_student_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_transfer_certificates_student_id ON public.transfer_certificates USING btree (student_id);


--
-- Name: ix_transfer_certificates_tc_number; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE UNIQUE INDEX ix_transfer_certificates_tc_number ON public.transfer_certificates USING btree (tc_number);


--
-- Name: ix_users_branch_id; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_users_branch_id ON public.users USING btree (branch_id);


--
-- Name: academic_calendar academic_calendar_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_calendar
    ADD CONSTRAINT academic_calendar_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;


--
-- Name: admin_login_otp_challenges admin_login_otp_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.admin_login_otp_challenges
    ADD CONSTRAINT admin_login_otp_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: attendance attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: audit_logs audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: auth_refresh_sessions auth_refresh_sessions_replaced_by_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.auth_refresh_sessions
    ADD CONSTRAINT auth_refresh_sessions_replaced_by_session_id_fkey FOREIGN KEY (replaced_by_session_id) REFERENCES public.auth_refresh_sessions(id);


--
-- Name: auth_refresh_sessions auth_refresh_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.auth_refresh_sessions
    ADD CONSTRAINT auth_refresh_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: classes classes_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: data_audit_logs data_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.data_audit_logs
    ADD CONSTRAINT data_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: enrollments enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: exam_subject_configs exam_subject_configs_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exam_subject_configs
    ADD CONSTRAINT exam_subject_configs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exam_subject_configs exam_subject_configs_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exam_subject_configs
    ADD CONSTRAINT exam_subject_configs_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: exams exams_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: exams exams_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: fee_payments fee_payments_student_fee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_student_fee_id_fkey FOREIGN KEY (student_fee_id) REFERENCES public.student_fees(id);


--
-- Name: fee_structures fee_structures_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: fee_structures fee_structures_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: fee_structures fee_structures_fee_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_fee_head_id_fkey FOREIGN KEY (fee_head_id) REFERENCES public.fee_heads(id);


--
-- Name: academic_years fk_academic_years_branch_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT fk_academic_years_branch_id FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: attendance fk_attendance_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT fk_attendance_enrollment_id FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: classes fk_classes_branch_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_classes_branch_id FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: fee_payments fk_fee_payments_online_order_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fk_fee_payments_online_order_id FOREIGN KEY (online_order_id) REFERENCES public.online_payment_orders(id);


--
-- Name: marks fk_marks_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT fk_marks_enrollment_id FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: online_payment_orders fk_online_payment_orders_student_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.online_payment_orders
    ADD CONSTRAINT fk_online_payment_orders_student_id FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: student_fees fk_student_fees_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT fk_student_fees_enrollment_id FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: student_fees fk_student_fees_source_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT fk_student_fees_source_invoice_id FOREIGN KEY (source_invoice_id) REFERENCES public.student_fees(id) ON DELETE SET NULL;


--
-- Name: students fk_students_branch_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_branch_id FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: students fk_students_parent_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_parent_user_id_users FOREIGN KEY (parent_user_id) REFERENCES public.users(id);


--
-- Name: students fk_students_student_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_student_user_id_users FOREIGN KEY (student_user_id) REFERENCES public.users(id);


--
-- Name: users fk_users_branch_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_branch_id FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: import_batch_items import_batch_items_import_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batch_items
    ADD CONSTRAINT import_batch_items_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;


--
-- Name: import_batches import_batches_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: marks marks_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- Name: marks marks_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: marks marks_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: notification_log notification_log_outbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_outbox_id_fkey FOREIGN KEY (outbox_id) REFERENCES public.notification_outbox(id);


--
-- Name: notification_log notification_log_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: online_payment_orders online_payment_orders_student_fee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.online_payment_orders
    ADD CONSTRAINT online_payment_orders_student_fee_id_fkey FOREIGN KEY (student_fee_id) REFERENCES public.student_fees(id);


--
-- Name: operation_jobs operation_jobs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.operation_jobs
    ADD CONSTRAINT operation_jobs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: otp_verifications otp_verifications_activation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_activation_request_id_fkey FOREIGN KEY (activation_request_id) REFERENCES public.student_activation_requests(id) ON DELETE CASCADE;


--
-- Name: portal_activation_invites portal_activation_invites_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites
    ADD CONSTRAINT portal_activation_invites_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: portal_activation_invites portal_activation_invites_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.portal_activation_invites
    ADD CONSTRAINT portal_activation_invites_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: profile_correction_requests profile_correction_requests_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.profile_correction_requests
    ADD CONSTRAINT profile_correction_requests_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: profile_correction_requests profile_correction_requests_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.profile_correction_requests
    ADD CONSTRAINT profile_correction_requests_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(id);


--
-- Name: profile_correction_requests profile_correction_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.profile_correction_requests
    ADD CONSTRAINT profile_correction_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: report_cards report_cards_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.report_cards
    ADD CONSTRAINT report_cards_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;


--
-- Name: report_cards report_cards_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.report_cards
    ADD CONSTRAINT report_cards_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- Name: student_activation_requests student_activation_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_activation_requests
    ADD CONSTRAINT student_activation_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_fees student_fees_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: student_fees student_fees_fee_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_fee_structure_id_fkey FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structures(id);


--
-- Name: student_fees student_fees_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: students students_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: students students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: subjects subjects_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: teacher_class_assignments teacher_class_assignments_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT teacher_class_assignments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: teacher_class_assignments teacher_class_assignments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT teacher_class_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: teacher_class_assignments teacher_class_assignments_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT teacher_class_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: teacher_class_assignments teacher_class_assignments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.teacher_class_assignments
    ADD CONSTRAINT teacher_class_assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transfer_certificates transfer_certificates_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.transfer_certificates
    ADD CONSTRAINT transfer_certificates_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- PostgreSQL database dump complete
--

\unrestrict pks7KcdNJlalNhYzO6ovhleLZUZhiv1SOLpc5b1hTKC0fymrDHJwX2Dy2bZhZHd

