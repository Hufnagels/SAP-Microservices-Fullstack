
interface Company {
  name: string;
  address: string;
  sales: number;
  lat?: number;
  lon?: number;
}

export const mockApiData: Company[] = [
    {
        name: "Tech Solutions Inc",
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        sales: 1500000,
        
    },
    {
        name: "Digital Ventures LLC",
        address: "1 Apple Park Way, Cupertino, CA",
        sales: 2300000,
        
    },
    {
        name: "Innovation Hub Co",
        address: "350 Mission St, San Francisco, CA",
        sales: 980000,
        lat: 37.7908723,
        lon: -122.3967204
    },
    {
        name: "Global Systems Ltd",
        address: "1 Microsoft Way, Redmond, WA",
        sales: 3200000,
        lat: 47.6419855,
        lon: -122.1269277
    },
    {
        name: "Cloud Services Inc",
        address: "410 Terry Ave N, Seattle, WA",
        sales: 1750000,
        lat: 47.622298,
        lon: -122.3365001
    },
    {
        name: "Data Analytics Pro",
        address: "1000 W Maude Ave, Sunnyvale, CA",
        sales: 1200000,
        lat: 37.3926737,
        lon: -122.0420227
    },
    {
        name: "Smart Tech Corp",
        address: "500 Oracle Parkway, Redwood City, CA",
        sales: 2100000,
        lat: 37.5308068,
        lon: -122.2622662
    }
]

// export default mockApiData;
/*
  VevőKód	VevőNév	SzállításiCím	NettóÉrtékesítés	BruttóÉrtékesítés	
V00005	Alt és Társa Bt.	2600 Vác, BAUER MIHÁLY U. 59/B	164.431.860,00	208.828.459,00	
V00017	Békás Nagykereskedelmi Kft.	1037 Budapest, Bojtár utca 55-57.	131.350.259,00	166.814.831,00	
V00053	JM-Metzger GmbH	DE-74219 Möckmühl, Halle 5 Bittelbronner Straße	159.435.672,00	159.435.672,00	
V00077	PREMIUMSALES KFT.	1044 Budapest, Almakerék u. 4	119.220.588,00	151.410.146,00	
V00177	G.E.Trade Kft.	2120 Dunakeszi, Repülotéri út 1.	97.884.350,00	124.313.127,00	
V00040	Gasztrofutár Kft.	1205 Budapest, Révay u. 33.	79.717.682,00	101.241.457,00	
V00071	PAPYRUS HUNGÁRIA Zrt.	1239 Budapest, Európa u. 6	71.226.454,00	90.457.597,00	
V00051	HYGENIA SRL.	00193 Latina, Via monti Lepini km 50	85.476.552,00	85.476.552,00	
V00054	Kelet Higiénia Kft	,	67.185.036,00	85.324.993,00	
V00093	TEGEE HUNGARIA KFT.	1044 Budapest, Ipari park utca 4.	58.966.236,00	74.201.360,00	
V00061	Merida Kft	,	47.857.968,00	60.779.619,00	
V00039	G. & M. Kreitner Gesellschaft m.b.H.	2361 Laxenburg, G. & M. Kreitner Logistik, Frankstahlstraße 1.	39.527.467,00	39.527.467,00	
V00013	Assist-Trend Pilis Kft.	,	30.782.294,00	39.093.519,00	
V00010	Assist-Trend Budapest Kft.	,	29.632.158,00	37.632.841,00	
V00009	Assist-Trend Győr Kft.	,	29.044.180,00	36.886.109,00	
V00003	Alföld Higiénia Kft	,	27.819.762,00	35.331.097,00	
V00082	RollPaper Kft.	2600 Vác, Görgey Artúr utca 1. 2. em. 9.	27.145.872,00	33.994.254,00	
V00019	BELT Slovakia s.r.o.	SK-82106 Bratislava, Samorínska 1	28.596.989,00	28.596.989,00	
V00069	Papír Group Kft.	2000 Szentendre, Rózsa utca 6/a	18.609.834,00	23.634.491,00	
V00141	ATA-BODOLAI Kft.	2120 Dunakeszi, Repülotéri út 1.	17.914.296,00	22.751.156,00	
V00007	Arnestad Storkjøkken AS	1081 Oslo, Professor Birkelandsvei  24 A	22.396.033,00	22.396.033,00	
V00018	BELT Hungary Kft.	1116 Budapest, Kondorosi út 3.	16.260.168,00	20.650.413,00	
V00011	Assist-Trend Észak Kft.	,	15.378.356,00	19.530.513,00	
V00051	HYGENIA SRL.	25010 Brescia, Via Galileo Galilei	18.032.176,00	18.032.176,00	
V00087	Schwabo Zrt.	1106 Budapest, Bogáncsvirág utca 5-7.	14.133.661,00	17.949.749,00	
V00001	2 AGY Bt.	,	13.573.958,00	17.238.925,00	
V00079	Proo Kft	1138 Budapest, Váci út 140. 4. em.	11.513.364,00	14.621.972,00	
V00078	Prizma FM Services Kft.	2330 Dunaharaszti, Jedlik Ányos út 9-11. (Észak)	10.927.320,00	13.877.696,00	
V00157	Eco Sales Hungary	2750 Nagykőrös, Szolnoki út 25	10.340.548,00	13.132.497,00	
V00024	Clean Medic Kft.	8900 Zalaegerszeg, Zrínyi út. 93	8.592.156,00	10.912.038,00	
V00014	Assist-Trend Tisza Kft.	,	8.259.502,00	10.489.568,00	
V00076	Precíz szolgáltatás Kft	,	7.959.212,00	10.108.198,00	
V00158	SLEEVE PACK HUNGARY Kft	2120 Dunakeszi, Repülotéri út 1.	7.958.144,00	10.106.844,00	
V00101	Vectra-Line Plus Kft.	2146 Mogyoród, Szadai út 10.	7.834.574,00	9.949.908,00	
V00098	Uni-B Magyarország Kft.	1131 Budapest, Dolmány utca 14.	6.794.676,00	8.629.238,00	
V00017	Békás Nagykereskedelmi Kft.	,	6.692.896,00	8.499.977,00	
V00012	ASSIST-TREND KANIZSA KFT.	8800 Nagykanizsa, Szeghalmi Bálint utca 1.	6.166.674,00	7.831.675,00	
V00183	Vig-Business Kft.	,	5.877.168,00	7.464.003,00	
V00081	RoClean Kereskedelmi és Szolgáltató Betéti Társaság	4200 Hajdúszoboszló, Pávai Vajna Ferenc u. 20.	5.815.800,00	7.386.066,00	
V00013	Assist-Trend Pilis Kft.	2534 Tát, Törökvész u. 7.	5.737.764,00	7.286.962,00	
V00007	Arnestad Storkjøkken AS	1860 Trøgstad, Langstad og Sønn AS, CO/Arnestad Storkjøkken, Industriområdet Grav  8	6.982.989,00	6.982.989,00	
V00065	Nova-Papír Zrt.	1136 Budapest, Hegedűs Gyula utca 16, I.em 5	5.408.448,00	6.868.728,00	
V00066	Nyír-Full-Tech Kft.	4400 Nyíregyháza, Nyíl u. 6.	5.383.996,00	6.837.675,00	
V00025	Daniel Cernota	725 28 Ostrava-Lhotka, Pøíkrá 165	6.664.530,00	6.664.530,00	
V00022	Budafok Recycling Zrt.	2000 Szentendre, Dózsa Gy. út 22.	6.397.555,00	6.397.555,00	
V00186	Korrekt Higiénia Kft.	7100 Szekszárd, Tartsay utca	4.787.632,00	6.080.293,00	
V00023	BUZGÓ, s.r.o.	,	6.017.272,00	6.017.272,00	
V00084	SC ADECOR PROD SRL	0510172 Santion, COM BORS, NR 398	5.971.107,00	5.971.107,00	
V00119	Maródi és Fiai Nagykereskedelmi Kft	2120 Dunakeszi, Repülotéri út 1.	4.362.144,00	5.539.923,00	
V00176	Kraft FM Üzemeltetési és Szolgáltató Kft.	1158 Budapest, Fázis utca 6.	4.252.080,00	5.400.142,00	
V00097	Trans-Uni Kft	1116 Budapest, Temesvár u. 19-21	3.922.670,00	4.981.790,00	
V00099	Unitrak Bt.	7130 Tolna, Pajta tér 771/1	3.911.296,00	4.967.346,00	
V00181	Exim Ex d.o.o.	1000 LJUBLJANA, LETALIŠKA CESTA, 027	4.176.600,00	4.176.600,00	
V00122	MAIER PAPIER GmbH	2120 Dunakeszi, Repülotéri út 1.	4.033.798,00	4.033.798,00	
V00129	Molino Reklámügynökség Kft.	2120 Dunakeszi, Repülotéri út 1.	3.094.560,00	3.930.091,00	
V00123	AMBROPEK spol.s.r.o.	2120 Dunakeszi, Repülotéri út 1.	3.285.864,00	3.285.864,00	
V00015	Asso Imballo Kft.	1103 Budapest, Gyömrői út 108-126.	2.498.472,00	3.173.059,00	
V00139	Goodpharma Kft	2120 Dunakeszi, Repülotéri út 1.	2.250.180,00	2.857.729,00	
V00059	MasterClean Kft.	1139 Budapest, Forgách utca 19	2.157.534,00	2.740.068,00	
V00111	PHASE FM Services Kft.	1158 Budapest, Fázis u. 6	2.124.540,00	2.698.166,00	
V00020	Bos-Plus Kft.	5000 Szolnok, Thököly út 113.	2.119.290,00	2.691.498,00	
V00057	Logobox Kft.	1044 Budapest, Almakerék u. 3.	1.962.240,00	2.492.046,00	
V00080	RLP Higiénia Kft.	2100 Gödöllő, Kőrösi Csoma utca 42. A.ép.1.	1.908.984,00	2.424.411,00	
V00028	Doman Servis, s.r.o.	040 11 Kosice, Miskovecka 19	2.262.392,00	2.262.392,00	
V00075	Prakticell Kft.	,	1.759.608,00	2.234.703,00	
V00188	Europapier Bohemia spol. s r.o.	2120 Dunakeszi, Repülotéri út 1.	1.416.668,00	1.799.168,00	
V00167	Csaplár-Szadai Papír Kft	2120 Dunakeszi, Repülotéri út 1.	1.275.744,00	1.620.195,00	
V00130	Mogyorósi sütemény Kft.	2120 Dunakeszi, Repülotéri út 1.	1.075.536,00	1.365.931,00	
V00086	Scatola Plastica Kft.	3300 Eger, Baktai út 20.	926.640,00	1.176.834,00	
V00045	Higiénia Trade Hungary Kft	6710 Szeged, Móricz Zsigmond u. 11.a	893.340,00	1.134.541,00	
V00113	PILLE-HUNGÁRIA Zrt.	2120 Dunakeszi, Repülotéri út 1.	664.848,00	844.357,00	
V00101	Vectra-Line Plus Kft.	,	656.280,00	833.476,00	
V00168	Ladó-Rec Kft.	2120 Dunakeszi, Repülotéri út 1.	591.800,00	751.586,00	
V00176	Kraft FM Üzemeltetési és Szolgáltató Kft.	,	581.376,00	738.348,00	
V00077	PREMIUMSALES KFT.	,	541.024,00	687.100,00	
V00133	L & L Company World Kft	2120 Dunakeszi, Repülotéri út 1.	457.920,00	581.559,00	
V00190	Pasterix Kft.	8000 Székesfehérvár, Fecskepart utca	456.192,00	579.364,00	
V00058	Madison Office Center Kft.	1042 Budapest, Árpád út 13.II.4.	437.760,00	555.956,00	
V00092	Techsol Hungary Kft	2220 Vecsés, Széchényi köz 3.	405.900,00	515.494,00	
V00158	SLEEVE PACK HUNGARY Kft	6000 Kecskemét, Korhánközi út 16.	403.200,00	512.064,00	
V00011	Assist-Trend Észak Kft.	3533 Miskolc, Kiss Ernő u. 17.	383.580,00	487.147,00	
V00182	Multicompact Kft.	9721 Gencsapáti, Deák Ferenc utca	367.380,00	466.572,00	
V00064	MOPABC Nagykereskedelmi Kft.	1096 Budapest, Sobieski János u. 40.	334.548,00	424.876,00	
V00174	Assist - Trend Ladorec Kft.	2120 Dunakeszi, Repülotéri út 1.	295.845,00	375.723,00	
V00127	Otthon Üzletház Kft.	2120 Dunakeszi, Repülotéri út 1.	289.728,00	367.955,00	
V00180	Baczka György EV	2120 Dunakeszi, Repülotéri út 1.	285.192,00	362.194,00	
V00132	Black Point Kft.	3713 Arnót, külterület 0102/7	217.140,00	275.768,00	
V00054	Kelet Higiénia Kft	4300 Nyírbátor, Ipartelepi utca 2/A	197.569,00	250.913,00	
V00128	Assist-Trend Kft Lábatlan	2536 Nyergesújfalu, Öreg Telep	194.400,00	246.888,00	
V00109	Rajat Bt	2100 Gödöllő, Isaszegi út 34	184.848,00	234.757,00	
V00129	Molino Reklámügynökség Kft.	2120 Dunakeszi, Repülotéri út 1.	159.456,00	202.509,00	
V00161	Ice  Cube  Logistics Zrt.	2120 Dunakeszi, Repülotéri út 1.	120.600,00	153.162,00	
V00178	Sződliget Nagyközség Önkormányzata	2133 Sződliget, Szt. István utca	49.200,00	62.484,00	
V00179	Képdoktor Kft.	2120 Dunakeszi, Repülotéri út 1.	15.120,00	19.203,00	
V00160	Interbolt.eu Kft.	2120 Dunakeszi, Repülotéri út 1.	1.608,00	2.042,00	
V00131	S.C. Nova Safe S.R.L.	2120 Dunakeszi, Repülotéri út 1.	0,00	0,00	
*/