--
-- PostgreSQL database dump
--

\restrict Cr7XrihQomtVqy1eDeNw55KcZl2if0eBQZsIcZ6Po0FW4eEkr7Qk075aHNmOlQQ

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
    is_upcoming boolean DEFAULT false NOT NULL
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
    status character varying(5) NOT NULL
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
-- Name: classes; Type: TABLE; Schema: public; Owner: sms_user
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    division character varying(5),
    academic_year_id integer,
    capacity integer,
    medium character varying(20) DEFAULT 'English'::character varying,
    promotion_status character varying(20) DEFAULT 'not_started'::character varying NOT NULL
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
    collected_by character varying(100)
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
    locked_at timestamp with time zone
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
    source_invoice_id integer
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
    contact character varying(10) NOT NULL,
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
    guardian_phone character varying(20)
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
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


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
-- Name: marks id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks ALTER COLUMN id SET DEFAULT nextval('public.marks_id_seq'::regclass);


--
-- Name: notification_outbox id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_outbox ALTER COLUMN id SET DEFAULT nextval('public.notification_outbox_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


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
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


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
-- Name: marks marks_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


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
-- Name: ix_calendar_year_dates; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_calendar_year_dates ON public.academic_calendar USING btree (academic_year_id, start_date, end_date);


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
-- Name: ix_marks_student_exam; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_marks_student_exam ON public.marks USING btree (student_id, exam_id);


--
-- Name: ix_notification_outbox_next_attempt_at; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_outbox_next_attempt_at ON public.notification_outbox USING btree (next_attempt_at);


--
-- Name: ix_notification_outbox_status; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_notification_outbox_status ON public.notification_outbox USING btree (status);


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
-- Name: ix_student_fees_student_year; Type: INDEX; Schema: public; Owner: sms_user
--

CREATE INDEX ix_student_fees_student_year ON public.student_fees USING btree (student_id, academic_year_id);


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
-- Name: academic_calendar academic_calendar_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.academic_calendar
    ADD CONSTRAINT academic_calendar_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;


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
-- Name: classes classes_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


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
-- Name: student_fees fk_student_fees_source_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT fk_student_fees_source_invoice_id FOREIGN KEY (source_invoice_id) REFERENCES public.student_fees(id) ON DELETE SET NULL;


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
-- Name: otp_verifications otp_verifications_activation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sms_user
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_activation_request_id_fkey FOREIGN KEY (activation_request_id) REFERENCES public.student_activation_requests(id) ON DELETE CASCADE;


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

\unrestrict Cr7XrihQomtVqy1eDeNw55KcZl2if0eBQZsIcZ6Po0FW4eEkr7Qk075aHNmOlQQ

