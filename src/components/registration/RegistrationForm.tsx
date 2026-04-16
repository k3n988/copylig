'use client'

import { useEffect, useRef, useState } from 'react'
import { useHouseholdStore } from '@/store/householdStore'
import { assessTriage } from '@/lib/triage'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { supabase } from '@/lib/supabase'
import type { RegistrySource, Vulnerability } from '@/types'
import TriagePreview from './TriagePreview'
import PasswordModal from './PasswordModal'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((n) => chars[n % chars.length]).join('')
}

async function hashPassword(plain: string): Promise<string> {
  const encoded = new TextEncoder().encode(plain + 'LIGTAS_SALT_2025')
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SOURCE_OPTIONS: { value: RegistrySource; label: string }[] = [
  { value: 'Senior Citizen Registry', label: 'Senior Citizen Registry (OSCA)' },
  { value: 'PWD Registry', label: 'PWD Registry (CPDAO)' },
  { value: 'Maternal Health Record', label: 'Maternal Health Record (RHU/BHW)' },
  { value: 'CSWDO Database', label: 'CSWDO Database' },
  { value: 'BHW Field Survey', label: 'BHW Field Survey / Community Round' },
]

const VULN_OPTIONS: { value: Vulnerability; label: string }[] = [
  { value: 'Bedridden', label: 'Bedridden' },
  { value: 'Senior', label: 'Senior Citizen' },
  { value: 'Wheelchair', label: 'Wheelchair User' },
  { value: 'Infant', label: 'Infant / Toddler' },
  { value: 'Pregnant', label: 'Pregnant' },
  { value: 'PWD', label: 'PWD' },
  { value: 'Oxygen', label: 'Oxygen Dependent' },
  { value: 'Dialysis', label: 'Dialysis Patient' },
]

const NEGROS_OCCIDENTAL: Record<string, string[]> = {
  'Bacolod City': [
    'Alangilan', 'Alijis', 'Banago', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
    'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10', 'Barangay 11', 'Barangay 12',
    'Barangay 13', 'Barangay 14', 'Barangay 15', 'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19',
    'Barangay 20', 'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25', 'Barangay 26',
    'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30', 'Barangay 31', 'Barangay 32', 'Barangay 33',
    'Barangay 34', 'Barangay 35', 'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40',
    'Barangay 41', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan',
    'Mansilingan', 'Montevista', 'Pahanocoy', 'Punta Taytay', 'Singcang-Airport', 'Sum-ag', 'Taculing',
    'Tangub', 'Villamonte', 'Vista Alegre',
  ],
  'Bago City': [
    'Abuanan', 'Alianza', 'Atipuluan', 'Bacong', 'Bagroy', 'Balingasag', 'Binubuhan', 'Busay', 'Calumangan',
    'Caridad', 'Don Jorge L. Araneta', 'Dulao', 'Ilijan', 'Lag-asan', 'Ma-ao Barrio', 'Mailum', 'Malingin',
    'Napoles', 'Pacol', 'Poblacion', 'Sagasa', 'Sampinit', 'Tabunan', 'Taloc',
  ],
  'Cadiz City': ['Andres Bonifacio', 'Burgos', 'Cabahug', 'Cadiz Viejo', 'Caduha-an', 'Celestino Villacin', 'Daga', 'Jerusalem', 'Luna', 'Mabini', 'Magsaysay', 'Sicaba', 'Tiglawigan', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'],
  'Murcia': ['Abejuvela', 'Amaya', 'Anahaw', 'Buenavista', 'Caliban', 'Canlandog', 'Cansilayan', 'Damsite', 'Iglau-an', 'Lopez Jaena', 'Minoyan', 'Pandanon', 'Salvacion', 'San Miguel', 'Santa Cruz', 'Santa Rosa', 'Talotog', 'Zone I', 'Zone II', 'Zone III', 'Zone IV', 'Zone V'],
  'La Carlota City': ['Ara-al', 'Ayungon', 'Balabag', 'Barangay I', 'Barangay II', 'Barangay III', 'Batuan', 'Cubay', 'Haguimit', 'La Granja', 'Nagasi', 'Roberto S. Benedicto', 'San Miguel', 'Yubo'],
  'Sagay City': ['Bato', 'Baviera', 'Bulanon', 'Campo Himoga-an', 'Campo Santiago', 'Colonia Divina', 'Fabrica', 'General Luna', 'Himoga-an Baybay', 'Lopez Jaena', 'Malubon', 'Molocaboc', 'Old Sagay', 'Plaridel', 'Poblacion I', 'Poblacion II', 'Rizal', 'Sewane', 'Taba-ao', 'Tadlong', 'Vito'],
  'Silay City': ['Bagtic', 'Balaring', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Guimbala-on', 'Guinhalaran', 'Kapitan Ramon', 'Lantad', 'Mambulac', 'Patag', 'Rizal'],
  'Talisay City': ['Bubog', 'Cabacungan', 'Concepcion', 'Dos Hermanas', 'Efigenio Lizares', 'Katubhan', 'Matab-ang', 'Poblacion', 'San Fernando', 'Tanza', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10', 'Zone 11', 'Zone 12', 'Zone 12-A', 'Zone 14', 'Zone 14-A', 'Zone 14-B', 'Zone 15', 'Zone 16'],
  'Victorias City': ['Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Barangay XI', 'Barangay XII', 'Barangay XIII', 'Barangay XIV', 'Barangay XV', 'Barangay XVI', 'Barangay XVII', 'Barangay XVIII', 'Barangay XIX', 'Barangay XX', 'Barangay XXI'],
  'Himamaylan City': ['Aguisan', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Buenavista', 'Cabadiangan', 'Cabanbanan', 'Carabalan', 'Libacao', 'Mahalang', 'Nabali-an', 'San Antonio', 'Saraet', 'Su-ay', 'Talaban', 'To-oy'],
  'Kabankalan City': ['Bantayan', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Binicuil', 'Camansi', 'Camingawan', 'Camugao', 'Carol-an', 'Daan Banua', 'Hilamonan', 'Inapoy', 'Linao', 'Locotan', 'Magballo', 'Oringao', 'Orong', 'Pinaguinpinan', 'Salong', 'Tabugon', 'Tagoc', 'Tagukon', 'Tampalon', 'Tan-Awan', 'Tayum'],
  'Escalante City': ['Alimango', 'Balintawak', 'Binaguiohan', 'Buenavista', 'Cervantes', 'Dian-ay', 'Haba', 'Japitan', 'Jonobjonob', 'Langub', 'Libertad', 'Mabini', 'Magsaysay', 'Malasibog', 'Old Poblacion', 'Paitan', 'Pinapugasan', 'Rizal', 'Tamlang', 'Udtongan', 'Washington'],
  'San Carlos City': ['Bagonbon', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Buluangan', 'Codcod', 'Ermita', 'Guadalupe', 'Nataban', 'Palampas', 'Prinza', 'Prosperidad', 'Punao', 'Quezon', 'Rizal', 'San Juan'],
  'Hinigaran': ['Anahaw', 'Aranda', 'Baga-as', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Bato', 'Calapi', 'Camalobalo', 'Cambugsa', 'Candumarao', 'Gargato', 'Himaya', 'Miranda', 'Nanunga', 'Narauis', 'Palaca', 'Paticui', 'Pilar', 'Quiwi', 'Tagda', 'Tuguis'],
  'Cauayan': ['Abaca', 'Baclao', 'Basak', 'Bulata', 'Caliling', 'Camalanda-an', 'Camansi', 'Canlamay', 'Isio', 'Linaon', 'Mambugsay', 'Molobolo', 'Poblacion', 'Sipalay', 'Talacdan', 'Tambad', 'Tiling', 'Tomina', 'Tuyom'],
  'Sipalay City': ['Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Cabadiangan', 'Camindangan', 'Canturay', 'Cartagena', 'Cayhagan', 'Gil Montilla', 'Mambaroto', 'Nabulao', 'Nauhang', 'San Jose', 'Sangi'],
  'Ilog': ['Andulauan', 'Balicotoc', 'Bocana', 'Calubang', 'Canlamay', 'Consolacion', 'Dancalan', 'Delicioso', 'Gatuslao', 'Malabago', 'Manalad', 'Pinggot', 'Poblacion', 'Tabu', 'Vista Alegre'],
  'Isabela': ['Amin', 'Bara-as', 'Binadlan', 'Bungahin', 'Cansalongon', 'Guintubhan', 'Libas', 'Mansablay', 'Mayondon', 'Panaquiao', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9', 'Riverside', 'Rumirang', 'San Agustin', 'Sikatuna'],
  'La Castellana': ['Bi-ao', 'Cabacungan', 'Cabagna-an', 'Camandag', 'Lalagsan', 'Mansalanao', 'Masulog', 'Nato', 'Pajo', 'Poblacion', 'Sag-ang', 'Talaptap'],
  'Manapla': ['Chambery', 'Purisima', 'Punta Mesa', 'Punta Salong', 'Santa Rita', 'Tortosa', 'Barangay I', 'Barangay I-A', 'Barangay I-B', 'Barangay II', 'Barangay II-A'],
  'Moises Padilla': ['Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Crossing Magallon', 'Guinpana-an', 'Inolingan', 'Macagahay', 'Magallon Cadre', 'Odiong', 'Quintin Remo'],
  'Pontevedra': ['Barangay I', 'Barangay II', 'Barangay III', 'Burgos', 'Canroma', 'Don Salvador Benedicto', 'Gomez', 'Mabini', 'Miranda', 'Pandanan', 'Recreo', 'San Juan', 'San Nicolas', 'San Pedro', 'San Rafael', 'San Roque', 'Santa Monica', 'Trinidad', 'Zamora'],
  'Pulupandan': ['Barangay Zone 1', 'Barangay Zone 2', 'Barangay Zone 3', 'Barangay Zone 4', 'Barangay Zone 4-A', 'Barangay Zone 5', 'Barangay Zone 6', 'Barangay Zone 7', 'Canroma', 'Crossing Belen', 'Mabini', 'Pag-ayon', 'Palaka Norte', 'Palaka Sur', 'Poblacion', 'Puntataytay', 'San Agustin', 'Santa Ana', 'Tapong', 'Ubay'],
  'San Enrique': ['Bagonawa', 'Baliwagan', 'Batuan', 'Guijalo', 'Nayon', 'Poblacion', 'Sibucao', 'Tabao Baybay', 'Tabao Proper', 'Tibsoc'],
  'Toboso': ['Bandila', 'Bug-ang', 'General Luna', 'Magticol', 'Poblacion', 'Salamanca', 'San Isidro', 'San Jose', 'Tabun-ac'],
  'Valladolid': ['Alijis', 'Ayungon', 'Bagumbayan', 'Batuan', 'Bayot', 'Central Tabao', 'Dancalan', 'Guimbala-on', 'Mabini', 'Pacol', 'Palaka', 'Poblacion', 'Sagua', 'Tabao Proper'],
  'Don Salvador Benedicto': ['Bago', 'Bagong Silang', 'Kandoni', 'Kumalascas', 'Pinowayan', 'Pandanon', 'Pinowayan'],
  'Calatrava': ['Ani-e', 'Bagacay', 'Bantayanon', 'Buenavista', 'Cabadiangan', 'Cambayobo', 'Castellano', 'Cruz', 'Dolis', 'Hilub-ang', 'Hinab-ongan', 'Ilaya', 'Laga-an', 'Lalong', 'Lemery', 'Lipat-on', 'Lo-oc', 'Ma-aslob', 'Malasibog', 'Malubay', 'Minapasuk', 'Mahilum', 'Paghumayan', 'Pantao', 'Patun-an', 'Pinocutan', 'Poblacion', 'Refugio', 'San Benito', 'San Jose', 'Suba', 'Telim', 'Tigbao', 'Tigbon', 'Winaswasan'],
  'Candoni': ['Agboy', 'Banga', 'Cabia-an', 'Caningay', 'Gatuslao', 'Haba', 'Paglumutan', 'Payauan', 'Poblacion East', 'Poblacion West'],
  'E.B. Magalona': ['Alacaygan', 'Alicante', 'Batea', 'Canroma', 'Consing', 'Cudangdang', 'Gahit', 'Latasan', 'Madalag', 'Manta-angan', 'Nanca', 'Pasil', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'San Jose', 'Tabigue', 'Tanza', 'Tomongtong'],
  'Salvador Benedicto': ['Bago', 'Bagong Silang', 'Igliyan', 'Kumalascas', 'Pandanon', 'Pinowayan', 'Poblacion'],
}

const ILOILO: Record<string, string[]> = {
  'Iloilo City': [ 
    'Baldoza', 'Balabago', 'Bantud', 'Banuyao', 'Bolilao', 'Buntatala', 'Burgos-Corazon', 'Calaparan',
    'Camacho', 'Camalig', 'Cochero', 'Compania', 'Cubay', 'Democracia', 'Dungon A', 'Dungon B', 'Dungon C',
    'East Baluarte', 'East Timawa', 'Fajardo', 'General Hughes', 'Hipodromo', 'Infante', 'Ingore',
    'Jalandoni Estate', 'Javellana', 'Jereos', 'Kahirupan', 'La Paz Proper', 'Laguda', 'Lanit',
    'Lapuz Norte', 'Lapuz Sur', 'Liberation Road', 'Libertad Barangay Proper', 'Lopez Jaena Norte',
    'Lopez Jaena Sur', 'Luna', 'Mabini', 'Magsaysay Village', 'Mansaya-Lapuz', 'Marcelo H. Del Pilar',
    'Maria Clara', 'Molo Proper', 'Mohon', 'North Baluarte', 'North Fundidor', 'Oñate De Leon',
    'Pale Benedicto Rizal', 'Plaza Libertad', 'Poblacion Molo', 'President Roxas', 'Progreso', 'Punong',
    'Railway', 'Rizal Estanzuela', 'Rizal Pala-Pala', 'San Isidro Norte', 'San Isidro Sur', 'San Jose',
    'Santa Cruz', 'Santo Domingo', 'Santo Nino Norte', 'Santo Nino Sur', 'Santo Rosario-Duran', 'Santo Tomas',
    'Seminario', 'Simon Ledesma', 'So-oc', 'South Baluarte', 'South Fundidor', 'Taal', 'Tabuc Suba',
    'Taytay Zone II', 'Taytay Zone III', 'Ticud La Paz', 'Timawa Tanza I', 'Timawa Tanza II',
    'Veterans Village', 'West Habog-habog', 'West Timawa', 'Yulo Drive', 'Zamora-Melliza', 'Zerrudo',
  ],
  'Dumangas': ['Bagumbayan', 'Balabag', 'Balud', 'Bancal', 'Baras', 'Bolhog', 'Calaboa', 'Calayo', 'Carmelo', 'Casapatan', 'Cato', 'Dawis', 'Ilang-Ilang', 'Libo-on Dalipe', 'Mabigo', 'Macalbang', 'Macatol', 'Malusgod', 'Nabitasan', 'Natividad', 'Paloc Bigque', 'Paloc Sool', 'Panayon', 'Patag', 'Poblacion', 'Pulao', 'Pungtod Daot', 'San Pedro', 'San Roque', 'Sarabia', 'Sinibaran', 'Taminla', 'Tubigan', 'Tulatula Norte', 'Tulatula Sur', 'Zaido'],
  'Guimbal': ['Baclayan', 'Bagumbayan', 'Balantad', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Buhang', 'Cabasi', 'Calam-isan', 'Cansilayan', 'Dalicanan', 'Igcagay', 'Ibo', 'Igbaras', 'Libo-on', 'Mabisil', 'Maite Norte', 'Maite Sur', 'Manguining', 'Mongpong', 'Poblacion', 'Tan-Agan', 'Tina', 'Tinocuan'],
  'Janiuay': ['Agsirab', 'Alugmawa', 'Badiangan', 'Balabag', 'Balibagan Oeste', 'Balibagan Este', 'Binubusan', 'Bita-og Bubo', 'Bololacao', 'Cabagu', 'Cabudian', 'Caguisa', 'Canawili', 'Canawon', 'Cañete', 'Daga', 'Dalicanan', 'Gines', 'Guibuangan', 'Igbaras', 'Jalung', 'Lacay-Lacay', 'Layog', 'Lomboy Bungol', 'Lumanay', 'Madarog', 'Malapawe', 'Managuisi', 'Moroboro', 'Natividad', 'Panginman', 'Pasig', 'Pispis', 'Poblacion', 'Quinagaringan Fagtan', 'Quinagaringan Guia', 'Sagcup', 'Salug', 'San Rafael', 'Sebarin', 'Sinuagan', 'Tanao', 'Tigbauan', 'Tupian', 'Ugbo'],
  'Leganes': ['Adlawon', 'Aganan', 'Ampids', 'Balabag', 'Balijuagan', 'Bito-on', 'Buenavista', 'Buntatala', 'Cagamutan Norte', 'Cagamutan Sur', 'Calawagan', 'Cari Mayor', 'Cari Minor', 'Guanko', 'Handog', 'Libo-on Mabasa', 'Libo-on Saging', 'Maliwanag', 'Naga', 'Napnapan Norte', 'Napnapan Sur', 'Pavia', 'Poblacion', 'Sambag', 'San Jose', 'San Pedro', 'Tacas', 'Tagbac', 'Timbang', 'Tina', 'Tuburan', 'Ubohan', 'Zarraga'],
  'Miagao': ['Agdum', 'Alimodian', 'Bacorong', 'Badiang', 'Bagumbayan', 'Balibagan', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Barangay XI', 'Barangay XII', 'Barangay XIII', 'Batuan', 'Bita-og', 'Bulaqueña', 'Bularan', 'Bungahan', 'Bungan', 'Cabilauan', 'Cagbanaba', 'Cagbano', 'Caipilan', 'Calagtangan', 'Calamaisan', 'Calbari', 'Casanayan', 'Caticlan', 'Cawayan', 'Cubay', 'Dawog', 'Gebio-an', 'Guisian', 'Igbago', 'Igpalge', 'Ilaya', 'Imbon', 'Indag-an', 'Kirayan Norte', 'Kirayan Tacas', 'Laglag', 'Lanot', 'Locse', 'Mabayan', 'Macaronao', 'Mambatad', 'Narat-an', 'Pajo', 'Pamuringao Proper', 'Panuran', 'Sibunag', 'Siol Norte', 'Tabucan', 'Tacas', 'Tacdangan', 'Tando', 'Tinaytayan', 'Tipolo', 'To-og', 'Tubog', 'Tuburan Norte', 'Tuburan Sur', 'Ubos'],
  'Oton': ['Aguinaldo', 'Bagongbong', 'Bantud', 'Batiano', 'Bito-on Barangay I', 'Bito-on Barangay II', 'Botong', 'Buaya', 'Cabanbanan', 'Caboloan', 'Cagbang', 'Calubian', 'Capao', 'Carangahan', 'Casualan', 'Dungon', 'Esteban', 'Fundidor', 'Ge-awang', 'Janipaan Este', 'Janipaan Oeste', 'Janipaan Natalio', 'Janipaan Melchor', 'Jorog', 'Lanot', 'Libo-on Mabasa', 'Majanlud', 'Malabor', 'Mambusao', 'Mansaya', 'Mansila', 'Moroboro', 'Morooro', 'Napnapan', 'Narat-an', 'Pagotpot', 'Pangi', 'Pantalan Nabaye', 'Pantalan Navarro', 'Poblacion', 'Polo', 'Puyas', 'Quezon Norte', 'Quezon Sur', 'Sa-ang', 'Salngan', 'San Antonio', 'San Nicolas', 'San Pedro', 'Santo Tomas', 'Sapa', 'Sipitan', 'Sog-ong', 'Tigum', 'Tiogon', 'Tuburan', 'Tugaslon', 'Tumagbok', 'Ungka I', 'Ungka II'],
  'Passi City': ['Agdayao', 'Aglobong', 'Agsalanan', 'Agtabo', 'Agtambo', 'Antonino', 'Ayaman', 'Bagumbayan', 'Batu', 'Bitaogan', 'Buenavista', 'Bugtong Lumboy', 'Bugtong Naulid', 'Cabalabaguan', 'Cabaruan', 'Cabugao', 'Calamian', 'Calaocan', 'Calleng', 'Camandag', 'Capitan Ramon', 'Caran', 'Cuyos', 'Dita', 'Estancia', 'Ferrer', 'Gines', 'Gutad', 'Lanas', 'Langca', 'Lawis', 'Linao', 'Linao Norte', 'Luca', 'Mambog', 'Manganese', 'Manticon', 'Maquilao', 'Matigu-an', 'Naba', 'Nipa', 'Pandan', 'Pantao', 'Patong-patong', 'Pisao', 'Poblacion Ilawod', 'Poblacion Ilaya', 'Poblacion Poblacion', 'Poblacion Tabuc', 'Punong', 'Quinagaringan', 'Sablogon', 'Salapadan', 'Salngan', 'Salvacion', 'Ticuan', 'Tugas', 'Tugaslon', 'Tuig', 'Tumcon Ilawod', 'Tumcon Ilaya', 'Ugsod', 'Wigan'],
  'Pavia': ['Aganan', 'Ampid', 'Balabag', 'Balijuagan', 'Barasan Este', 'Barasan Oeste', 'Bohnon', 'Buyuan', 'Caingin', 'Cairohan', 'Dawag', 'Guinhawa Norte', 'Guinhawa Sur', 'Inday', 'Libo-on Saging', 'Linao', 'Lubog', 'Malumpati', 'Naga', 'Napnapan Norte', 'Napnapan Sur', 'Narat-an', 'Omambong', 'Pantalan', 'Pavia Proper', 'Pototan', 'San Agustin', 'San Pedro', 'Tacas', 'Tigum', 'Ungka I', 'Ungka II'],
  'Pototan': ['Aganan', 'Alupidian', 'Amamaros', 'Bagacay', 'Balabag', 'Balaticon', 'Banban', 'Bantayan', 'Bantud', 'Barasan', 'Batuan', 'Bongco', 'Buenavista', 'Buga', 'Cabilauan', 'Cagbang', 'Caguisanan', 'Calaughan', 'Callang', 'Calolot', 'Camandag', 'Canvenas', 'Caposong', 'Casit-an', 'Dawag', 'Ginalinan', 'Hipona', 'Inay-Inay', 'Jalandoni', 'Jito-o', 'Kagutayan', 'Lampaya', 'Lanot', 'Lawi', 'Linao', 'Lugta', 'Luthangan', 'Madarog', 'Mandu-calahig', 'Mano', 'Marilag', 'Misi', 'Moroboro', 'Naslo', 'Navalas', 'Omadan', 'Pandan Espina', 'Poblacion Norte', 'Poblacion Sur', 'Protaras', 'Punong', 'Quiasan', 'Rojas', 'Sambag', 'Samonte', 'San Agustin', 'San Antonio', 'San Marcos', 'San Pedro', 'Sibacungan', 'Sicad Norte', 'Sicad Sur', 'Siwalo', 'Suelo', 'Sugal', 'Tabuc Norte', 'Tabuc Sur', 'Tabucan', 'Taminla', 'Tamisu Norte', 'Tamisu Sur', 'Tanao', 'Tinaytayan', 'Tugas', 'Tugaslon', 'Tularog', 'Tumcon'],
  'San Miguel': ['Anilao', 'Asluman', 'Baguingin-Lanot', 'Baluarte', 'Bantayan', 'Barasan', 'Batuan', 'Bongco', 'Buenavista', 'Bungca', 'Bunga', 'Burgos', 'Cabilauan', 'Cag-an', 'Camohonan', 'Candari', 'Candelaria', 'Capinahan', 'Caposong', 'Caray-caray', 'Dakay', 'Daria', 'Estanza', 'Girado', 'Gobonseng', 'Gubang', 'Igcabuad', 'Inogbong', 'Lanjagan', 'Lublub', 'Madarug', 'Manhug', 'Menan', 'Nagusan', 'Nalbugan', 'Oboob', 'Olango', 'Palauan', 'Pandan', 'Pasay', 'Piñan', 'Poblacion', 'Polo', 'Purog', 'Quipot', 'Sagcup', 'Saliguipan', 'San Isidro', 'San Jose', 'San Nicolas', 'San Pedro', 'Sibagon', 'Sibucao', 'Silagon', 'Sinamhay', 'Sinogayan', 'Sulanga', 'Tabuc Ponong', 'Tabucan', 'Tagsalakan', 'Talongonan', 'Tamis', 'Ticuan', 'Tigbauan', 'Tomina', 'Tugaslon', 'Tumao', 'Ubohan', 'Ubujan', 'Yamog'],
  'Santa Barbara': ['Agusipan', 'Atimonan', 'Bagong Silang', 'Bagumbayan', 'Balabag', 'Balatucan', 'Banban', 'Barasan', 'Batiano', 'Bayunan', 'Bubon Pusod', 'Buenavista', 'Bugasong', 'Bulo Norte', 'Bulo Sur', 'Bunsoran', 'Cabilauan', 'Cagbang', 'Caguyuman', 'Canabuan', 'Cansilayan', 'Capinahan', 'Capitangan', 'Casit-an', 'Dajao', 'Dalicanan', 'Duhawan', 'Guanko', 'Guinamacan', 'Guiso', 'Igcabugao', 'Igbaras', 'Ilang-Ilang', 'Lanas', 'Lipata', 'Logansing', 'Lundag', 'Malawog', 'Mambisoc', 'Mambuyo', 'Mango', 'Manibad', 'Matacong', 'Mincal', 'Nalbugan', 'Napnapan', 'Narat-an', 'Niño', 'Odiong', 'Olaer-Sibunag', 'Pader', 'Palomoc', 'Pasileng Norte', 'Pasileng Sur', 'Patong-patong', 'Pitogo', 'Poblacion', 'Quinagayungan', 'Quinal-oan', 'Sablogon', 'Sacripante', 'Saladan', 'San Agustin', 'San Andres', 'San Antonio', 'San Fernando', 'San Isidro', 'San Jose', 'San Luis', 'San Marcos', 'San Miguel', 'San Pablo', 'San Pedro', 'San Ramon', 'San Roque', 'Santa Rita', 'Santo Tomas', 'Sian', 'Siba-an', 'Sulangan', 'Tabucan', 'Talagutac', 'Tambal', 'Tanque', 'Tigbauan', 'Timawa', 'Tinpas', 'Tipolo', 'Tumcon', 'Turog-turog', 'Utod', 'Wigan'],
  'Tigbauan': ['Alupidian', 'Bag-ong Barrio', 'Baguingin', 'Bahay', 'Balabag', 'Balikian', 'Balingsag', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Binanua-an', 'Buenavista', 'Bugasong', 'Buntatala', 'Cabalabaguan', 'Cabalic', 'Cabubugan', 'Cagbuhangin', 'Calagtangan', 'Calampitao', 'Cari', 'Dalije', 'Dugman', 'Gua-an', 'Guisian', 'Igcocok', 'Igdolo', 'Igpas', 'Igpuro', 'Ilaya Norte', 'Ilaya Sur', 'Indag-an', 'Ito-o', 'Jamul-awon', 'Lanot', 'Libo-on Nava', 'Ligaya', 'Luca', 'Mabyang', 'Malabed', 'Malag-it Norte', 'Malag-it Sur', 'Minoyan', 'Naro', 'Natividad', 'Negrillos', 'Oyungan', 'Pacuan', 'Panggabungan', 'Pitogo', 'Poblacion Norte', 'Poblacion Sur', 'Salamanca', 'Salucot', 'San Pedro', 'Serallo', 'Sibucad', 'Siol', 'Tabugon', 'Taligaman', 'Talong Cogon', 'Taminla', 'Tigbayog', 'Tiringanan', 'Tubod Norte', 'Tubod Sur'],
  'Ajuy': ['Agubot', 'Badiangan', 'Barrido', 'Bato Biasong', 'Bay-ang', 'Bucana Bunglas', 'Central', 'Culasi', 'Lanjagan', 'Luca', 'Malayuan', 'Mangorocoro', 'Nasidman', 'Pantalan Nabaye', 'Pantalan Navarro', 'Pedada', 'Pili', 'Pinantan Diel', 'Pinantan Elizalde', 'Poblacion', 'Progreso', 'Puente Bunglas', 'San Antonio', 'Silagon', 'Tagubanhan', 'Tugas', 'Ubuhan'],
  'Alimodian': ['Abang-abang', 'Agsing', 'Atabayan', 'Baguingin-Lanot', 'Bancal', 'Binalud', 'Bugang', 'Cabalic', 'Cabacanan Proper', 'Cabacanan Rizal', 'Coline-Dalag', 'Cuyad', 'Gines', 'Gubayan', 'Ingas', 'Libas', 'Lico', 'Lugong', 'Mambalite', 'Manasa', 'Manduyog', 'Poblacion', 'Punong', 'Quinaspan', 'Sinamay', 'Sulong', 'Tabug', 'Tawin-tawin', 'Ulay-Bugang', 'Ulay-Hinablan', 'Umondacan'],
  'Anilao': ['Agbatuan', 'Badiang', 'Balunos', 'Cagpu-an', 'Ciriaco Montaño', 'Dangula-an', 'Guinpana-an', 'Manganese', 'Medina', 'Mostro', 'Palaypay', 'Pantalan', 'Poblacion', 'San Carlos', 'San Juan Crisostomo', 'Santa Rita', 'Serallo', 'Vista Alegre'],
  'Badiangan': ['Badiangan', 'Bingawan', 'Botong', 'Budiawe', 'Cabayogan', 'Calansanan', 'Catubig', 'Guinacas', 'Iraya', 'Linao', 'Ma-asin', 'Manaolan', 'Odiongan', 'Poblacion', 'San Julian', 'Sariri', 'Sianon', 'Talaba', 'Tamisu'],
  'Balasan': ['Bacubac', 'Balanti-an', 'Batuan', 'Cabalic', 'Carvasana', 'Cawayan', 'Dolores', 'Gimamanay', 'Ipil', 'Kinalasag', 'Lantangan', 'Lawis', 'Lumbuyan', 'Mamhut Norte', 'Mamhut Sur', 'Maya', 'Nabitasan', 'Poblacion', 'Quiasan', 'Salong', 'Zaragosa'],
  'Banate': ['Alacaygan', 'Badiangan', 'Belisong', 'Bobon', 'Bularan', 'Carmelo', 'De la Paz', 'Dugwaman', 'Juanico', 'Libertad', 'Magdalo', 'Manaygon', 'Merced', 'Poblacion', 'San Salvador', 'Talokgangan', 'Zona Sur'],
  'Barotac Nuevo': ['Agutayan', 'Bagonawa', 'Baras', 'Bungca', 'Cabilauan', 'Cruz', 'Guintas', 'Igbong', 'Lagubang', 'Linao', 'Monpon', 'Natividad', 'Palaciawan', 'Poblacion', 'Salihid', 'So-oc', 'Tabucan', 'Talisay', 'Tiwi'],
  'Barotac Viejo': ['Bugnay', 'California', 'Del Pilar', 'General Luna', 'Natividad', 'Poblacion', 'San Antonio', 'San Francisco', 'San Juan', 'San Lucas', 'San Miguel', 'San Rafael', 'San Roque', 'San Vicente', 'Santiago', 'Santo Domingo', 'Vista Alegre'],
  'Batad': ['Alapasco', 'Amayong', 'Binon-an', 'Bulak Norte', 'Bulak Sur', 'Cabagohan', 'Calangag', 'Caw-i', 'Hamod', 'Malublub', 'Pasayan', 'Poblacion', 'Quiba-an', 'Salong', 'Santa Cruz', 'Tanza'],
}

const NEGROS_ORIENTAL: Record<string, string[]> = {
  'Canlaon City': [
    'Bayog', 'Binalbagan', 'Bucalan', 'Budlasan', 'Linothangan', 'Lumapao', 'Mabigo', 'Malaiba', 'Masulog', 'Ninoy Aquino', 'Panubigan', 'Pula'
  ],
  'Dumaguete City': [
    'Bagacay', 'Bajumpandan', 'Balugo', 'Banilad', 'Bantayan', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barangay 8', 'Batinguel', 'Buñao', 'Cadawinonan', 'Calindagan', 'Camanjac', 'Candau-ay', 'Cantil-e', 'Daro', 'Junob', 'Looc', 'Mangnao-Canal', 'Motong', 'Piapi', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Pulantubig', 'Tabuctubig', 'Taclobo', 'Talay'
  ],
  'Bayawan City': [
    'Ali-is', 'Banaybanay', 'Banga', 'Bayawan City Proper', 'Bugay', 'Cansumalig', 'Dawis', 'Kalamtukan', 'Kalumboyan', 'Malabugas', 'Mandu-ao', 'Manini-on', 'Minaba', 'Nangka', 'Narra', 'Pagatban', 'Pantao', 'Poblacion', 'San Jose', 'San Roque', 'Suba', 'Tabuan', 'Tayawan', 'Ubante', 'Villareal'
  ],
  'Guihulngan City': [
    'Bakia', 'Balogo', 'Banwague', 'Basak', 'Binobohan', 'Bulado', 'Calamba', 'Buenavista', 'Imelda', 'Kagusuan', 'Linantuyan', 'Luz', 'Mabunga', 'Magsaysay', 'Malusay', 'Maniak', 'Mckinley', 'Planas', 'Poblacion', 'Sandayao', 'Tacpao', 'Tinidad', 'Villegas'
  ],
  'Bais City': [
    'Barangay I', 'Barangay II', 'Cabancalan', 'Calasga-an', 'Cambuilao', 'Canauay', 'Capinahan', 'Consolacion', 'Dansulan', 'Hangyad', 'La Paz', 'Lo-oc', 'Mabunao', 'Manini-on', 'Olandiao', 'Panala-an', 'Poblacion', 'Sab-ahan', 'Tagbao', 'Tamisu', 'Tamogong', 'Tangculogan', 'Valencia'
  ],
  'Tanjay City': [
    'Azagra', 'Bahi-an', 'Luca', 'Manipis', 'Novallas', 'Obogon', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'Poblacion IV', 'Poblacion V', 'Poblacion VI', 'Poblacion VII', 'Poblacion VIII', 'Poblacion IX', 'San Isidro', 'San Jose', 'San Miguel', 'Santa Cruz Nuevo', 'Santa Cruz Viejo', 'Santo Niño', 'Tugas'
  ],
  'Amlan': ['Bio-os', 'Jantianon', 'Jugno', 'Mag-abo', 'Poblacion', 'Silab', 'Tambojangin'],
  'Ayungon': ['Amdus', 'Anibong', 'Atabay', 'Awa-an', 'Banban', 'Calagcalag', 'Candana-ay', 'Carol-an', 'Gomentoc', 'Inacban', 'Iniban', 'Lamigan', 'Maaslum', 'Mabato', 'Manogtong', 'Nabhang', 'Poblacion', 'South Poblacion', 'Talaon', 'Tambo', 'Tampocon I', 'Tampocon II', 'Tibyawan', 'Tungas'],
  'Bacong': ['Balayagmanok', 'Banilad', 'Buntis', 'Buntod', 'Combado', 'Doldol', 'Isugan', 'Liptong', 'Lutao', 'Magatas', 'Malabago', 'Mampas', 'Nabago', 'Poblacion', 'Sacsac', 'San Miguel', 'Sumbic', 'Timbanga', 'Tubod'],
  'Bindoy': ['Atotes', 'Batangan', 'Bulod', 'Cabcaban', 'Camudlas', 'Canluto', 'Danao', 'Domolog', 'Manini-on', 'Matobato', 'Nagbalaye', 'Poblacion', 'Salong', 'Tagaytay', 'Tinaogan', 'Tubod'],
  'Dauin': ['Anahaw', 'Apo Island', 'Bagacay', 'Baslay', 'Batuhon Dacu', 'Bulak', 'Bunga', 'Casile', 'Libjo', 'Lipayo', 'Maayongtubig', 'Mag-aso', 'Magsaysay', 'Malabag', 'Masaplod Norte', 'Masaplod Sur', 'Panubigan', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'Taluot', 'Tugawe', 'Tunga-tunga'],
  'Valencia': ['Apolinar Velez', 'Balili', 'Bong-ao', 'Bongbong', 'Cataylo', 'Caidiocan', 'Dobdob', 'Liptong', 'Lunga', 'Malabo', 'Malaunay', 'Mampas', 'Palinpinon', 'Poblacion', 'Pulangbato', 'Sagbang', 'West Balabag'],
}

const PROVINCE_MAP: Record<string, Record<string, string[]>> = {
  'Negros Occidental': NEGROS_OCCIDENTAL,
  'Iloilo': ILOILO,
  'Negros Oriental': NEGROS_ORIENTAL,
}

const PROVINCE_OPTIONS = Object.keys(PROVINCE_MAP).sort()

function resolveMapKey(cityVal: string, province: string): string | null {
  if (!cityVal) return null
  const map = PROVINCE_MAP[province]
  if (!map) return null

  const normalized = cityVal.trim().toLowerCase()
  if (map[cityVal]) return cityVal

  const exactCI = Object.keys(map).find((k) => k.toLowerCase() === normalized)
  if (exactCI) return exactCI

  const withCity = normalized.endsWith(' city') ? normalized : normalized + ' city'
  const cityMatch = Object.keys(map).find((k) => k.toLowerCase() === withCity)
  if (cityMatch) return cityMatch

  const withoutCity = normalized.replace(/ city$/, '').trim()
  const reverseMatch = Object.keys(map).find((k) => k.toLowerCase().replace(/ city$/, '') === withoutCity)
  if (reverseMatch) return reverseMatch
  return null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--fg-default)',
  borderRadius: 10,
  boxSizing: 'border-box',
  fontSize: '0.85rem',
  lineHeight: 1.35,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  marginBottom: 7,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '0.06em',
}

const subHeaderStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 800,
  color: 'var(--fg-default)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 14,
  borderLeft: '4px solid var(--accent-blue)',
  paddingLeft: 12,
}

export default function RegistrationForm() {
  const addHousehold = useHouseholdStore((s) => s.addHousehold)
  const households = useHouseholdStore((s) => s.households)
  const setPickingLocation = useHouseholdStore((s) => s.setPickingLocation)
  const pendingCoords = useHouseholdStore((s) => s.pendingCoords)
  const setPendingCoords = useHouseholdStore((s) => s.setPendingCoords)

  const geocodingLib = useMapsLibrary('geocoding')
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [coordsDisplay, setCoordsDisplay] = useState('')
  const [locating] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [pinSource, setPinSource] = useState<'gps' | 'map' | null>(null)

  const [geocoding, setGeocoding] = useState(false)
  const [provinceVal, setProvinceVal] = useState('Negros Occidental')
  const [cityVal, setCityVal] = useState('')
  const [barangayVal, setBarangayVal] = useState('')
  const [streetVal, setStreetVal] = useState('')

  const [vulnArr, setVulnArr] = useState<Vulnerability[]>([])
  const [sourceVal, setSourceVal] = useState<RegistrySource | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [credModal, setCredModal] = useState<{ contact: string; password: string } | null>(null)

  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder()
    }
  }, [geocodingLib])

  const detectCity = (pLat: number, pLng: number, fillStreet = false) => {
    if (!geocoderRef.current) return
    setGeocoding(true)

    geocoderRef.current.geocode({ location: { lat: pLat, lng: pLng } }, (results, status) => {
      setGeocoding(false)
      if (status !== 'OK' || !results?.length) return

      const comps = results[0].address_components
      const cityComp =
        comps.find((c) => c.types.includes('locality')) ||
        comps.find((c) => c.types.includes('administrative_area_level_3')) ||
        comps.find((c) => c.types.includes('administrative_area_level_2')) ||
        comps.find((c) => c.types.includes('administrative_area_level_1'))

      const provComp = comps.find((c) => c.types.includes('administrative_area_level_2'))
      const rawProv = provComp?.long_name?.trim() ?? ''
      const resolvedProv = PROVINCE_OPTIONS.find(p => p.toLowerCase() === rawProv.toLowerCase())
      
      if (resolvedProv) {
        setProvinceVal(resolvedProv)
      }

      const rawCity = cityComp?.long_name?.trim() ?? ''
      let resolved = resolveMapKey(rawCity, resolvedProv || provinceVal)

      if (resolved && (resolvedProv || provinceVal)) {
        setCityVal(resolved)
        setBarangayVal('')
      }

      if (fillStreet) {
        const formattedParts = results[0].formatted_address?.split(',') ?? []
        const streetParts = formattedParts.slice(0, -3).map((p) => p.trim()).filter(Boolean)
        const street = streetParts.join(', ')
        if (street) setStreetVal(street)
      }
    })
  }

  useEffect(() => {
    if (!pendingCoords) return
    setLat(pendingCoords.lat)
    setLng(pendingCoords.lng)
    setCoordsDisplay(`${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lng.toFixed(6)}`)
    setPinSource('map')
    setGpsAccuracy(null)
    detectCity(pendingCoords.lat, pendingCoords.lng)
  }, [pendingCoords]) // eslint-disable-line react-hooks/exhaustive-deps

  const triage = assessTriage(vulnArr)
  const resolvedCityKey = resolveMapKey(cityVal, provinceVal)

  const toggleVuln = (v: Vulnerability) => {
    setVulnArr((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  }

  const fullAddressPreview = [streetVal, barangayVal, cityVal, provinceVal]
    .filter(Boolean)
    .join(', ')

  const resetForm = () => {
    formRef.current?.reset()
    setVulnArr([])
    setLat(null)
    setLng(null)
    setCoordsDisplay('')
    setPinSource(null)
    setGpsAccuracy(null)
    setPendingCoords(null)
    setSourceVal('')
    setProvinceVal('Negros Occidental')
    setCityVal('')
    setBarangayVal('')
    setStreetVal('')
    setSaveError(null)
  }

  const sendCredentialSms = async (contact: string, password: string) => {
    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: contact,
          message: `LIGTAS: Registration successful. Contact: ${contact}. Temporary password: ${password}. Account type: citizen`,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { warning?: string; error?: string } | null

      if (!response.ok) {
        console.error('[LIGTAS] Household SMS failed:', payload?.error ?? payload?.warning ?? response.statusText)
        setSaveWarning(payload?.warning ?? 'Registration saved, but SMS delivery failed.')
      }
    } catch (error) {
      console.error('[LIGTAS] Household SMS request failed:', error)
      setSaveWarning('Registration saved, but SMS delivery failed.')
    }
  }

  const detectDuplicate = (contact: string, pLat: number, pLng: number) => {
    for (const hh of households) {
      if (hh.contact === contact) {
        return { isDuplicate: true, reason: `Contact ${contact} already registered (${hh.id}).` }
      }
      if (haversineMeters(pLat, pLng, hh.lat, hh.lng) <= 10) {
        return { isDuplicate: true, reason: `Household within 10 m already exists (${hh.id} - ${hh.head}).` }
      }
    }
    return { isDuplicate: false, reason: '' }
  }

  useEffect(() => {
    if (!saveSuccess) return
    const t = setTimeout(() => setSaveSuccess(null), 5000)
    return () => clearTimeout(t)
  }, [saveSuccess])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaveError(null)
    setSaveWarning(null)
    setSaveSuccess(null)

    if (!pinSource) {
      setSaveError('Please pin a location using GPS or the map before submitting.')
      return
    }
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      setSaveError('Invalid coordinates. Please re-pin the location.')
      return
    }
    if (!barangayVal.trim()) {
      setSaveError('Please select a barangay.')
      return
    }

    const form = e.currentTarget
    const fd = new FormData(form)
    const source = fd.get('source') as RegistrySource
    const contactVal = (fd.get('contact') as string).trim()
    const id = 'HH-' + Date.now().toString().slice(-6)

    const fullAddress = [streetVal, barangayVal, cityVal, provinceVal]
      .filter(Boolean)
      .join(', ')

    const { isDuplicate, reason } = detectDuplicate(contactVal, lat, lng)
    if (isDuplicate) {
      setSaveError(`Duplicate detected - ${reason}`)
      return
    }

    setSaving(true)
    try {
      let documentUrl: string | undefined
      const file = fileRef.current?.files?.[0]
      if (source === 'Self-Reported' && file) {
        const { data: up, error: ue } = await supabase.storage
          .from('verification-docs')
          .upload(`${id}/${file.name}`, file, { upsert: true })
        if (ue) throw ue
        const { data: ud } = supabase.storage.from('verification-docs').getPublicUrl(up.path)
        documentUrl = ud.publicUrl
      }

      const plainPassword = generatePassword()
      const passwordHash = await hashPassword(plainPassword)

      await addHousehold({
        id,
        lat,
        lng,
        city: cityVal,
        barangay: barangayVal,
        purok: (fd.get('purok') as string) || 'N/A',
        street: streetVal,
        fullAddress,
        structure: 'N/A',
        head: fd.get('head') as string,
        contact: contactVal,
        occupants: parseInt(fd.get('occupants') as string, 10),
        vulnArr,
        notes: (fd.get('notes') as string) || '',
        source,
        status: 'Pending',
        triage,
        approvalStatus: source === 'Self-Reported' ? 'pending_review' : 'approved',
        documentUrl,
        citizenPasswordHash: passwordHash,
        gpsAccuracy: gpsAccuracy ?? undefined,
        pinSource: pinSource ?? undefined,
      })

      const headName = fd.get('head') as string
      await sendCredentialSms(contactVal, plainPassword)
      resetForm()
      setSaveSuccess(`"${headName}" has been registered and pinned to the vulnerability map.`)
    } catch (err) {
      console.error('[LIGTAS] handleSubmit:', err)
      setSaveError('Failed to save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="sidebar-hero" style={{ marginBottom: 20, fontSize: '0.75rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--fg-default)', display: 'block', marginBottom: 4, fontSize: '0.88rem' }}>
            LGU Vulnerability Registry - Authorized Personnel Only
          </strong>
          <span style={{ color: 'var(--fg-muted)' }}>
            For use by Barangay Health Workers, CSWDO, and LGU field staff to digitize existing registries before disasters.
          </span>
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 20 }}>
          <h3 style={subHeaderStyle}>1. Rescue Location</h3>

          <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Latitude, Longitude</label>
            {pinSource && (
              <span style={{ fontSize: '0.68rem', color: pinSource === 'map' ? 'var(--accent-blue)' : 'var(--resolved-green)', fontWeight: 700 }}>
                {pinSource === 'map' ? 'Pinned on map' : 'GPS captured'}
                {gpsAccuracy !== null && ` · ±${gpsAccuracy} m`}
              </span>
            )}
          </div>

          <div className="sidebar-form-grid" style={{ marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, color: pinSource ? 'var(--accent-blue)' : 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}
              type="text"
              value={coordsDisplay}
              onChange={(e) => {
                const raw = e.target.value
                setCoordsDisplay(raw)
                setPinSource(null)
                setPendingCoords(null)
                setGpsAccuracy(null)
                const parts = raw.split(',').map((n) => parseFloat(n.trim()))
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  setLat(parts[0])
                  setLng(parts[1])
                } else {
                  setLat(null)
                  setLng(null)
                }
              }}
              placeholder="e.g. 10.676553, 122.954105"
              required
              readOnly={locating}
            />

            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="button-secondary"
              style={{ width: '100%', padding: '12px 14px', color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 800 }}
            >
              Manually Adjust Pin
            </button>
          </div>

          {geocoding && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)', fontSize: '0.78rem', marginBottom: 10, fontWeight: 600 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
              Detecting city...
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Province</label>
            <select
              name="province"
              required
              style={inputStyle}
              value={provinceVal}
              onChange={(e) => {
                setProvinceVal(e.target.value)
                setCityVal('')
                setBarangayVal('')
              }}
            >
              {PROVINCE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>
                City
                {geocoding ? (
                  <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--accent-blue)', fontWeight: 500, textTransform: 'none' }}>detecting...</span>
                ) : cityVal ? (
                  <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--resolved-green)', fontWeight: 700, textTransform: 'none' }}>auto-filled</span>
                ) : null}
              </label>
              <select
                name="city"
                required
                style={inputStyle}
                value={cityVal}
                onChange={(e) => {
                  setCityVal(e.target.value)
                  setBarangayVal('')
                }}
              >
                <option value="" disabled>
                  Select City
                </option>
                {Object.keys(PROVINCE_MAP[provinceVal] || {}).sort().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Barangay
                <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--fg-warning)', fontWeight: 700, textTransform: 'none' }}>manual</span>
              </label>
              <select
                name="barangay"
                required
                style={inputStyle}
                value={barangayVal}
                onChange={(e) => setBarangayVal(e.target.value)}
              >
                <option value="" disabled>
                  Select Barangay
                </option>
                {resolvedCityKey
                  ? PROVINCE_MAP[provinceVal][resolvedCityKey].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                      )) : null}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Street / Landmark</label>
            <input
              name="street"
              type="text"
              placeholder="House #, street, or landmark"
              required
              style={inputStyle}
              value={streetVal}
              onChange={(e) => setStreetVal(e.target.value)}
            />
          </div>

          {(streetVal || barangayVal || cityVal || provinceVal) && !geocoding && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-accent-soft)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700, marginRight: 6 }}>Address:</span>
              {fullAddressPreview}
            </div>
          )}
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 25 }}>
          <h3 style={subHeaderStyle}>2. Triage Intelligence</h3>
          <label style={{ ...labelStyle, marginTop: 15 }}>Vulnerability Profile</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-inset)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 12 }}>
            {VULN_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={vulnArr.includes(value) ? 'pill-option is-active' : 'pill-option'}
                style={{
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  color: (value === 'Bedridden' || value === 'Oxygen') && vulnArr.includes(value) ? 'var(--critical-red)' : 'var(--fg-default)',
                }}
              >
                <input type="checkbox" checked={vulnArr.includes(value)} onChange={() => toggleVuln(value)} style={{ width: 'auto', marginRight: 8, cursor: 'pointer' }} />
                {label}
              </label>
            ))}
          </div>
          <TriagePreview triage={triage} />
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 25 }}>
          <h3 style={subHeaderStyle}>3. Household Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Head of Household / Patient Name</label>
              <input name="head" type="text" placeholder="Full Name" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact Number</label>
              <input
                name="contact"
                type="tel"
                inputMode="numeric"
                placeholder="09xxxxxxxxx"
                required
                pattern="^(09[0-9]{9}|\\+639[0-9]{9})$"
                title="Enter a valid PH mobile number (e.g. 09171234567)"
                style={inputStyle}
                onInput={(e) => {
                  const input = e.currentTarget
                  const normalized = input.value.replace(/(?!^\+)[^\d]/g, '')
                  input.value = normalized.startsWith('+') ? `+${normalized.slice(1).replace(/[^\d]/g, '')}` : normalized
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Total Occupants</label>
              <input name="occupants" type="number" min="1" defaultValue="1" required style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 15 }}>
            <label style={labelStyle}>Data Source / Registry</label>
            <select name="source" required style={inputStyle} value={sourceVal} onChange={(e) => setSourceVal(e.target.value as RegistrySource)}>
              <option value="" disabled>
                Select Source
              </option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 15 }}>
            <label style={labelStyle}>Responder / Evacuation Notes</label>
            <textarea name="notes" rows={3} placeholder="Critical instructions (e.g. needs stretcher, 4 responders required)" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {saveError && (
          <div style={{ background: 'var(--bg-danger-subtle)', border: '1px solid var(--fg-danger)', color: 'var(--fg-danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.5 }}>
            {saveError}
          </div>
        )}

        {saveWarning && (
          <div style={{ background: 'rgba(240, 136, 62, 0.12)', border: '1px solid var(--fg-warning)', color: 'var(--fg-warning)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.5 }}>
            {saveWarning}
          </div>
        )}

        {saveSuccess && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--bg-success-subtle)',
            border: '1px solid var(--success-border)',
            color: 'var(--success-strong)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Registration Successful</div>
              <div style={{ fontWeight: 400, opacity: 0.85 }}>{saveSuccess}</div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || geocoding}
          className="button-primary"
          style={{
            width: '100%',
            padding: 15,
            background: saving ? 'var(--bg-elevated)' : 'var(--accent-blue)',
            color: saving ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            fontWeight: 'bold',
            cursor: saving || geocoding ? 'not-allowed' : 'pointer',
            marginTop: 10,
            fontSize: '0.9rem',
            opacity: geocoding ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : geocoding ? 'Detecting city...' : 'Register & Pin to Vulnerability Map'}
        </button>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 767px) {
          form > div[style*='grid-template-columns: repeat(2, minmax(0, 1fr))'],
          form > div[style*='grid-template-columns: 1fr 1fr'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}
