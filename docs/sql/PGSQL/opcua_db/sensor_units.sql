-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: opcua_db
-- Generation Time: 2026-05-09 21:11:19.4680
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."sensor_units";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS sensor_units_id_seq;

-- Table Definition
CREATE TABLE "public"."sensor_units" (
    "id" int4 NOT NULL DEFAULT nextval('sensor_units_id_seq'::regclass),
    "category" varchar(50) NOT NULL,
    "unit" varchar(30) NOT NULL,
    "description" varchar(100),
    "min_val" float8,
    "max_val" float8,
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX sensor_units_unit_key ON public.sensor_units USING btree (unit);

INSERT INTO "public"."sensor_units" ("id", "category", "unit", "description", "min_val", "max_val") VALUES
(1, 'Temperature', '°C', 'Celsius', NULL, NULL),
(2, 'Temperature', '°F', 'Fahrenheit', NULL, NULL),
(3, 'Temperature', 'K', 'Kelvin', NULL, NULL),
(4, 'Pressure', 'bar', 'Bar', NULL, NULL),
(5, 'Pressure', 'mbar', 'Millibar', NULL, NULL),
(6, 'Pressure', 'Pa', 'Pascal', NULL, NULL),
(7, 'Pressure', 'kPa', 'Kilopascal', NULL, NULL),
(8, 'Pressure', 'MPa', 'Megapascal', NULL, NULL),
(9, 'Pressure', 'psi', 'Pounds per square inch', NULL, NULL),
(10, 'Pressure', 'atm', 'Atmosphere', NULL, NULL),
(11, 'Flow', 'm³/h', 'Cubic metres per hour', NULL, NULL),
(12, 'Flow', 'L/min', 'Litres per minute', NULL, NULL),
(13, 'Flow', 'L/h', 'Litres per hour', NULL, NULL),
(14, 'Flow', 'm³/s', 'Cubic metres per second', NULL, NULL),
(15, 'Flow', 'kg/h', 'Kilograms per hour', NULL, NULL),
(16, 'Flow', 't/h', 'Tonnes per hour', NULL, NULL),
(17, 'Level', 'm', 'Metre', NULL, NULL),
(18, 'Level', 'cm', 'Centimetre', NULL, NULL),
(19, 'Level', 'mm', 'Millimetre', NULL, NULL),
(20, 'Level', '%', 'Percent', NULL, NULL),
(21, 'Speed', 'rpm', 'Revolutions per minute', NULL, NULL),
(22, 'Speed', 'm/s', 'Metres per second', NULL, NULL),
(23, 'Speed', 'm/min', 'Metres per minute', NULL, NULL),
(24, 'Electrical', 'V', 'Volt', NULL, NULL),
(25, 'Electrical', 'mV', 'Millivolt', NULL, NULL),
(26, 'Electrical', 'kV', 'Kilovolt', NULL, NULL),
(27, 'Electrical', 'A', 'Ampere', NULL, NULL),
(28, 'Electrical', 'mA', 'Milliampere', NULL, NULL),
(29, 'Electrical', 'Hz', 'Hertz', NULL, NULL),
(30, 'Power', 'W', 'Watt', NULL, NULL),
(31, 'Power', 'kW', 'Kilowatt', NULL, NULL),
(32, 'Power', 'MW', 'Megawatt', NULL, NULL),
(33, 'Power', 'kWh', 'Kilowatt-hour', NULL, NULL),
(34, 'Power', 'MWh', 'Megawatt-hour', NULL, NULL),
(35, 'Weight', 'kg', 'Kilogram', NULL, NULL),
(36, 'Weight', 't', 'Metric tonne', NULL, NULL),
(37, 'Weight', 'N', 'Newton', NULL, NULL),
(38, 'Weight', 'kN', 'Kilonewton', NULL, NULL),
(39, 'Time', 's', 'Second', NULL, NULL),
(40, 'Time', 'min', 'Minute', NULL, NULL),
(41, 'Time', 'h', 'Hour', NULL, NULL),
(42, 'Concentration', 'ppm', 'Parts per million', NULL, NULL),
(43, 'Concentration', 'pH', 'pH value', NULL, NULL),
(44, 'Concentration', 'mg/L', 'Milligrams per litre', NULL, NULL),
(45, 'Concentration', 'g/L', 'Grams per litre', NULL, NULL),
(46, 'Other', '—', 'Dimensionless / no unit', NULL, NULL),
(47, 'Speed', 'working_speed', 'Working speed (m/min)', 0, 500);
