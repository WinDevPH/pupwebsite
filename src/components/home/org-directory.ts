import barops from '@/assets/org-logos/barops.png'
import codal from '@/assets/org-logos/codal.png'
import comelec from '@/assets/org-logos/comelec.png'
import lacp from '@/assets/org-logos/lacp.png'
import mcds from '@/assets/org-logos/mcds.png'
import researchCorps from '@/assets/org-logos/research-corps.png'
import solicitor from '@/assets/org-logos/solicitor.png'
import studentCouncil from '@/assets/org-logos/student-council.png'

export const organizationsYear = 'A.Y. 2026–2027'

export const organizations = [
  {
    id: 'codal',
    short: 'CODAL',
    name: 'Christians On Demand At Law',
    facebook: 'https://www.facebook.com/ChristiansOnDemandAtLaw/',
    logo: codal,
  },
  {
    id: 'lacp',
    short: 'LACP',
    name: 'Legal Aid Clinic of PUP College of Law',
    facebook: 'https://www.facebook.com/puplawlegalaidclinic/',
    logo: lacp,
  },
  {
    id: 'comelec',
    short: 'COMELEC',
    name: 'PUP College of Law - COMELEC',
    facebook: 'https://www.facebook.com/PUPLawCOMELEC/',
    logo: comelec,
  },
  {
    id: 'research-corps',
    short: 'Research Corps',
    name: 'PUP College of Law Research Corps',
    facebook: 'https://www.facebook.com/PUPRC2015/',
    logo: researchCorps,
  },
  {
    id: 'student-council',
    short: 'Student Council',
    name: 'PUP College of Law Student Council',
    facebook: 'https://www.facebook.com/pupcl.sc',
    logo: studentCouncil,
  },
  {
    id: 'bar-ops',
    short: 'Bar Operations',
    name: 'PUP Law Bar Operations',
    facebook: 'https://www.facebook.com/PUPBarOperations',
    logo: barops,
  },
  {
    id: 'mcds',
    short: 'MCDS',
    name: 'PUP Law Moot Court and Debate Society',
    facebook: 'https://www.facebook.com/PUPLawMCDS/',
    logo: mcds,
  },
  {
    id: 'solicitor',
    short: 'The Solicitor',
    name: 'PUP College of Law - The Solicitor',
    facebook: 'https://www.facebook.com/solicitorpuplaw',
    logo: solicitor,
  },
] as const
