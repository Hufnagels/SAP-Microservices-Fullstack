-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: maps_db
-- Generation Time: 2026-05-10 09:13:43.5200
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."map_partners";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS map_partners_id_seq;

-- Table Definition
CREATE TABLE "public"."map_partners" (
    "id" int4 NOT NULL DEFAULT nextval('map_partners_id_seq'::regclass),
    "card_code" varchar(15) NOT NULL,
    "name" varchar(255) NOT NULL,
    "address" text NOT NULL DEFAULT ''::text,
    "sales" int8 NOT NULL DEFAULT 0,
    "lat" float8 NOT NULL,
    "lon" float8 NOT NULL,
    "synced_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX map_partners_card_code_key ON public.map_partners USING btree (card_code);

INSERT INTO "public"."map_partners" ("id", "card_code", "name", "address", "sales", "lat", "lon", "synced_at") VALUES
(1, 'M001', 'Alt és Társa Bt.', '2600 Vác, BAUER MIHÁLY U. 59/B', 208828459, 47.7874033, 19.141159, '2026-03-18 19:48:35.668451+00'),
(2, 'M002', 'Békás Nagykereskedelmi Kft.', '1037 Budapest, Bojtár utca 55-57.', 166814831, 47.5600942, 19.0278172, '2026-03-18 19:48:35.668451+00'),
(3, 'M003', 'JM-Metzger GmbH', 'DE-74219 Möckmühl, Bittelbronner Straße Halle 5', 159435672, 49.3276068, 9.3505023, '2026-03-18 19:48:35.668451+00'),
(4, 'M004', 'PREMIUMSALES KFT.', '1044 Budapest, Almakerék u. 4', 151410146, 47.5925053, 19.1037202, '2026-03-18 19:48:35.668451+00'),
(5, 'M005', 'G.E.Trade Kft.', '2120 Dunakeszi, Repülotéri út 1.', 124313127, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(6, 'M006', 'Gasztrofutár Kft.', '1205 Budapest, Révay u. 33.', 101241457, 47.4517079, 19.1138987, '2026-03-18 19:48:35.668451+00'),
(7, 'M007', 'PAPYRUS HUNGÁRIA Zrt.', '1239 Budapest, Európa u. 6', 90457597, 47.3773251, 19.120584, '2026-03-18 19:48:35.668451+00'),
(8, 'M008', 'HYGENIA SRL.', '00193 Latina, Via monti Lepini km 50', 85476552, 41.6046572, 12.6422122, '2026-03-18 19:48:35.668451+00'),
(9, 'M009', 'Kelet Higiénia Kft', '2120 Dunakeszi, Repülotéri út 1.', 85324993, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(10, 'M010', 'TEGEE HUNGARIA KFT.', '1044 Budapest, Ipari park utca 4.', 74201360, 47.5932348, 19.1026421, '2026-03-18 19:48:35.668451+00'),
(11, 'M011', 'Merida Kft', '2120 Dunakeszi, Repülotéri út 1.', 60779619, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(12, 'M012', 'Assist-Trend Pilis Kft.', '2120 Dunakeszi, Repülotéri út 1.', 39093519, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(13, 'M013', 'Assist-Trend Budapest Kft.', '2120 Dunakeszi, Repülotéri út 1.', 37632841, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(14, 'M014', 'Assist-Trend Győr Kft.', '2120 Dunakeszi, Repülotéri út 1.', 36886109, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(15, 'M015', 'Alföld Higiénia Kft', '2120 Dunakeszi, Repülotéri út 1.', 35331097, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(16, 'M016', 'BELT Slovakia s.r.o.', 'SK-82106 Bratislava, Samorínska 1', 28596989, 48.1231511, 17.2089024, '2026-03-18 19:48:35.668451+00'),
(17, 'M017', 'Papír Group Kft.', '2000 Szentendre, Rózsa utca 6/a', 23634491, 47.6559146, 19.0656229, '2026-03-18 19:48:35.668451+00'),
(18, 'M018', 'ATA-BODOLAI Kft.', '2120 Dunakeszi, Repülotéri út 1.', 22751156, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(19, 'M019', 'BELT Hungary Kft.', '1116 Budapest, Kondorosi út 3.', 20650413, 47.4520183, 19.0441166, '2026-03-18 19:48:35.668451+00'),
(20, 'M020', 'Assist-Trend Észak Kft.', '2120 Dunakeszi, Repülotéri út 1.', 19530513, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(21, 'M021', 'HYGENIA SRL. Brescia', '25010 Brescia, Via Galileo Galilei', 18032176, 45.4814082, 10.2142531, '2026-03-18 19:48:35.668451+00'),
(22, 'M022', 'Schwabo Zrt.', '1106 Budapest, Bogáncsvirág utca 5-7.', 17949749, 47.4835019, 19.195133, '2026-03-18 19:48:35.668451+00'),
(23, 'M023', '2 AGY Bt.', '2120 Dunakeszi, Repülotéri út 1.', 17238925, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(24, 'M024', 'Eco Sales Hungary', '2750 Nagykőrös, Szolnoki út 25', 13132497, 47.0291722, 19.7968054, '2026-03-18 19:48:35.668451+00'),
(25, 'M025', 'Assist-Trend Tisza Kft.', '2120 Dunakeszi, Repülotéri út 1.', 10489568, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(26, 'M026', 'Precíz szolgáltatás Kft', '2120 Dunakeszi, Repülotéri út 1.', 10108198, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(27, 'M027', 'SLEEVE PACK HUNGARY Kft', '2120 Dunakeszi, Repülotéri út 1.', 10106844, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(28, 'M028', 'Vectra-Line Plus Kft.', '2146 Mogyoród, Szadai út 10.', 9949908, 47.5977178, 19.2671976, '2026-03-18 19:48:35.668451+00'),
(29, 'M029', 'Uni-B Magyarország Kft.', '1131 Budapest, Dolmány utca 14.', 8629238, 47.5438622, 19.0897184, '2026-03-18 19:48:35.668451+00'),
(30, 'M030', 'Békás Nk. Kft. (2)', '2120 Dunakeszi, Repülotéri út 1.', 8499977, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(31, 'M031', 'ASSIST-TREND KANIZSA KFT.', '8800 Nagykanizsa, Szeghalmi Bálint utca 1.', 7831675, 46.467983, 17.0009884, '2026-03-18 19:48:35.668451+00'),
(32, 'M032', 'Vig-Business Kft.', '2120 Dunakeszi, Repülotéri út 1.', 7464003, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(33, 'M033', 'Assist-Trend Pilis Kft. Tát', '2534 Tát, Törökvész u. 7.', 7286962, 47.742673, 18.6693059, '2026-03-18 19:48:35.668451+00'),
(34, 'M034', 'Nyír-Full-Tech Kft.', '4400 Nyíregyháza, Nyíl u. 6.', 6837675, 47.9510481, 21.6779653, '2026-03-18 19:48:35.668451+00'),
(35, 'M035', 'Korrekt Higiénia Kft.', '7100 Szekszárd, Tartsay utca', 6080293, 46.3384262, 18.709267, '2026-03-18 19:48:35.668451+00'),
(36, 'M036', 'BUZGÓ, s.r.o.', '2120 Dunakeszi, Repülotéri út 1.', 6017272, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(37, 'M037', 'Maródi és Fiai Nk. Kft', '2120 Dunakeszi, Repülotéri út 1.', 5539923, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(38, 'M038', 'Kraft FM Üzemeltetési Kft.', '1158 Budapest, Fázis utca 6.', 5400142, 47.5327382, 19.1408215, '2026-03-18 19:48:35.668451+00'),
(39, 'M039', 'Trans-Uni Kft', '1116 Budapest, Temesvár u. 19-21', 4981790, 47.4528717, 19.0420307, '2026-03-18 19:48:35.668451+00'),
(40, 'M040', 'Unitrak Bt.', '7130 Tolna, Pajta tér 771/1', 4967346, 46.4223886, 18.7852105, '2026-03-18 19:48:35.668451+00'),
(41, 'M041', 'Exim Ex d.o.o.', '1000 LJUBLJANA, LETALIŠKA CESTA, 027', 4176600, 46.0604177, 14.5386822, '2026-03-18 19:48:35.668451+00'),
(42, 'M042', 'MAIER PAPIER GmbH', '2120 Dunakeszi, Repülotéri út 1.', 4033798, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(43, 'M043', 'Molino Reklámügynökség Kft.', '2120 Dunakeszi, Repülotéri út 1.', 3930091, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(44, 'M044', 'AMBROPEK spol.s.r.o.', '2120 Dunakeszi, Repülotéri út 1.', 3285864, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(45, 'M045', 'Asso Imballo Kft.', '1103 Budapest, Gyömrői út 108-126.', 3173059, 47.4724251, 19.1387598, '2026-03-18 19:48:35.668451+00'),
(46, 'M046', 'Goodpharma Kft', '2120 Dunakeszi, Repülotéri út 1.', 2857729, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(47, 'M047', 'MasterClean Kft.', '1139 Budapest, Forgách utca 19', 2740068, 47.5384272, 19.0747934, '2026-03-18 19:48:35.668451+00'),
(48, 'M048', 'PHASE FM Services Kft.', '1158 Budapest, Fázis u. 6', 2698166, 47.5327382, 19.1408215, '2026-03-18 19:48:35.668451+00'),
(49, 'M049', 'Bos-Plus Kft.', '5000 Szolnok, Thököly út 113.', 2691498, 47.1886482, 20.1783878, '2026-03-18 19:48:35.668451+00'),
(50, 'M050', 'Logobox Kft.', '1044 Budapest, Almakerék u. 3.', 2492046, 47.5925053, 19.1037202, '2026-03-18 19:48:35.668451+00'),
(51, 'M051', 'Doman Servis, s.r.o.', '040 11 Kosice, Miskovecka 19', 2262392, 48.6999837, 21.2544371, '2026-03-18 19:48:35.668451+00'),
(52, 'M052', 'Prakticell Kft.', '2120 Dunakeszi, Repülotéri út 1.', 2234703, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(53, 'M053', 'Europapier Bohemia s.r.o.', '2120 Dunakeszi, Repülotéri út 1.', 1799168, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(54, 'M054', 'Csaplár-Szadai Papír Kft', '2120 Dunakeszi, Repülotéri út 1.', 1620195, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(55, 'M055', 'Mogyorósi sütemény Kft.', '2120 Dunakeszi, Repülotéri út 1.', 1365931, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(56, 'M056', 'Scatola Plastica Kft.', '3300 Eger, Baktai út 20.', 1176834, 47.9079887, 20.3612867, '2026-03-18 19:48:35.668451+00'),
(57, 'M057', 'Higiénia Trade Hungary Kft', '6710 Szeged, Móricz Zsigmond u. 11.a', 1134541, 46.2181924, 20.0804688, '2026-03-18 19:48:35.668451+00'),
(58, 'M058', 'PILLE-HUNGÁRIA Zrt.', '2120 Dunakeszi, Repülotéri út 1.', 844357, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(59, 'M059', 'Vectra-Line Plus Kft. (2)', '2120 Dunakeszi, Repülotéri út 1.', 833476, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(60, 'M060', 'Ladó-Rec Kft.', '2120 Dunakeszi, Repülotéri út 1.', 751586, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(61, 'M061', 'Kraft FM Kft. (2)', '2120 Dunakeszi, Repülotéri út 1.', 738348, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(62, 'M062', 'PREMIUMSALES KFT. (2)', '2120 Dunakeszi, Repülotéri út 1.', 687100, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(63, 'M063', 'L & L Company World Kft', '2120 Dunakeszi, Repülotéri út 1.', 581559, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(64, 'M064', 'Pasterix Kft.', '8000 Székesfehérvár, Fecskepart utca', 579364, 47.2062827, 18.4056191, '2026-03-18 19:48:35.668451+00'),
(65, 'M065', 'SLEEVE PACK HUNGARY Kft (2)', '6000 Kecskemét, Korhánközi út 16.', 512064, 46.8952418, 19.6741613, '2026-03-18 19:48:35.668451+00'),
(66, 'M066', 'Assist-Trend Észak Kft. Miskolc', '3533 Miskolc, Kiss Ernő u. 17.', 487147, 48.0993757, 20.7322502, '2026-03-18 19:48:35.668451+00'),
(67, 'M067', 'Multicompact Kft.', '9721 Gencsapáti, Deák Ferenc utca', 466572, 47.2735698, 16.6018254, '2026-03-18 19:48:35.668451+00'),
(68, 'M068', 'MOPABC Nagykereskedelmi Kft.', '1096 Budapest, Sobieski János u. 40.', 424876, 47.480243, 19.0835587, '2026-03-18 19:48:35.668451+00'),
(69, 'M069', 'Assist-Trend Ladorec Kft.', '2120 Dunakeszi, Repülotéri út 1.', 375723, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(70, 'M070', 'Otthon Üzletház Kft.', '2120 Dunakeszi, Repülotéri út 1.', 367955, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(71, 'M071', 'Baczka György EV', '2120 Dunakeszi, Repülotéri út 1.', 362194, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(72, 'M072', 'Kelet Higiénia Kft Nyírbátor', '4300 Nyírbátor, Ipartelepi utca 2/A', 250913, 47.84862, 22.1455217, '2026-03-18 19:48:35.668451+00'),
(73, 'M073', 'Rajat Bt', '2100 Gödöllő, Isaszegi út 34', 234757, 47.5882223, 19.3566928, '2026-03-18 19:48:35.668451+00'),
(74, 'M074', 'Molino Reklámügynökség (2)', '2120 Dunakeszi, Repülotéri út 1.', 202509, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(75, 'M075', 'Ice Cube Logistics Zrt.', '2120 Dunakeszi, Repülotéri út 1.', 153162, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(76, 'M076', 'Képdoktor Kft.', '2120 Dunakeszi, Repülotéri út 1.', 19203, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(77, 'M077', 'Interbolt.eu Kft.', '2120 Dunakeszi, Repülotéri út 1.', 2042, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00'),
(78, 'M078', 'S.C. Nova Safe S.R.L.', '2120 Dunakeszi, Repülotéri út 1.', 0, 47.616535, 19.1468515, '2026-03-18 19:48:35.668451+00');
