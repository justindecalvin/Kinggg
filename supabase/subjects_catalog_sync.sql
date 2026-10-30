-- Subject catalog only: extracted from the Scores repo's `subjects` field.
-- No students, grades, marks, results, or score records are present here.
-- Run in Supabase SQL Editor after the main `supabase/schema.sql` has been applied.
-- This replaces only public.school_state.key = 'stanbax_subjects'.

BEGIN;

INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
VALUES (
  'stanbax_subjects',
  $subject_catalog$[
  {
    "id": "sub-1",
    "code": "MTH",
    "description": "Pure and applied mathematics",
    "name": "Mathematics",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-2",
    "code": "ENG",
    "description": "Grammar, composition, comprehension, and oral English",
    "name": "English Language",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-3",
    "code": "PHY",
    "description": "Mechanics, electricity, optics, and modern physics",
    "name": "Physics",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-4",
    "code": "CHM",
    "description": "Physical, inorganic, and organic chemistry",
    "name": "Chemistry",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-5",
    "code": "BIO",
    "description": "Cell biology, physiology, ecology, and genetics",
    "name": "Biology",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-6",
    "code": "SIS",
    "description": "Foundations of integrated science",
    "name": "Intermediate Science",
    "applicableLevels": [
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-7",
    "code": "CHS",
    "department": "Humanities",
    "description": "Citizenship, ethics, and democratic principles",
    "name": "Citizenship and Heritage Studies",
    "applicableLevels": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-8",
    "code": "DT",
    "department": "Vocational & Tech",
    "description": "Information technology, coding, and digital literacy",
    "name": "Digital Technology",
    "applicableLevels": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-9",
    "code": "ECO",
    "description": "Macro and micro-economics",
    "name": "Economics",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-10",
    "code": "LIT",
    "description": "Prose, poetry, drama, and African literature",
    "name": "Literature in English",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-11",
    "code": "LSF",
    "department": "Vocational & Tech",
    "description": "Crop science, animal husbandry, and agricultural economics",
    "name": "Livestock Farming",
    "applicableLevels": [
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-12",
    "code": "FMT",
    "description": "Advanced calculus, matrices, and applied reasoning",
    "name": "Further Mathematics",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-13",
    "code": "FRN",
    "description": "French vocabulary, grammar, and conversational drills",
    "name": "French Language",
    "applicableLevels": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-14",
    "code": "HIS",
    "department": "Humanities",
    "description": "Nigerian History ",
    "name": "History",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-1793085091117",
    "code": "GOV",
    "department": "Humanities",
    "description": "The law and government studies ",
    "name": "Government",
    "applicableLevels": [
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-1793085168266",
    "code": "BST",
    "department": "Commercial",
    "description": "Book keeping, balancing books and business management ",
    "name": "Business Studies",
    "applicableLevels": [
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-1793085213193",
    "code": "YOR",
    "department": "Languages",
    "description": "Nigerian language ",
    "name": "Yoruba",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-1793096617151",
    "code": "CCA",
    "department": "Humanities",
    "description": "",
    "name": "Cultural and Creative Arts",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-1793096706221",
    "code": "PHE",
    "department": "Humanities",
    "description": "",
    "name": "Physical & Health Education",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-1793096749248",
    "code": "SCS",
    "department": "Humanities",
    "description": "",
    "name": "Social & Citizenship Studies",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-1793096775514",
    "code": "COMP",
    "department": "Vocational & Tech",
    "description": "",
    "name": "Computer",
    "applicableLevels": [
      "Early Years",
      "Primary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary"
    ]
  },
  {
    "id": "sub-1793096797056",
    "code": "WRT",
    "department": "Humanities",
    "description": "",
    "name": "Writing",
    "applicableLevels": [
      "Early Years",
      "Primary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary"
    ]
  },
  {
    "id": "sub-1793096827833",
    "code": "PVS",
    "department": "Vocational & Tech",
    "description": "",
    "name": "Prevocational Studies",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary"
    ]
  },
  {
    "id": "sub-1793096864250",
    "code": "BSE",
    "department": "Sciences",
    "description": "",
    "name": "Basic Science & Technology",
    "applicableLevels": [
      "Early Years",
      "Primary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary"
    ]
  },
  {
    "id": "sub-1793102070633",
    "code": "CRS",
    "department": "Humanities",
    "description": "",
    "name": "Cristian Religious studies",
    "applicableLevels": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]
  },
  {
    "id": "sub-1793102422032",
    "code": "LIT",
    "department": "Humanities",
    "description": "",
    "name": "Literature",
    "applicableLevels": [
      "Early Years",
      "Primary"
    ],
    "applicableCategories": [
      "Early Years",
      "Primary"
    ]
  },
  {
    "id": "sub-1793103508261",
    "code": "NUM",
    "department": "Humanities",
    "description": "",
    "name": "Numeracy",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793103538030",
    "code": "CIV",
    "department": "Humanities",
    "description": "",
    "name": "Civic",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793103567283",
    "code": "SHB",
    "department": "Humanities",
    "description": "",
    "name": "Social Habit",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793103632364",
    "code": "MRI",
    "department": "Humanities",
    "description": "",
    "name": "Moral Instruction",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793103658384",
    "code": "CRT",
    "department": "Humanities",
    "description": "",
    "name": "Creativity",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793103709321",
    "code": "MUS",
    "department": "Vocational & Tech",
    "description": "",
    "name": "Music",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793104434839",
    "code": "RHY",
    "department": "Humanities",
    "description": "",
    "name": "Rhyme",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  },
  {
    "id": "sub-1793104468269",
    "code": "PD",
    "department": "Vocational & Tech",
    "description": "",
    "name": "Personal Development",
    "applicableLevels": [
      "Early Years"
    ],
    "applicableCategories": [
      "Early Years"
    ]
  }
]$subject_catalog$::jsonb,
  true,
  'subject-catalog-sync',
  now()
)
ON CONFLICT (key) DO UPDATE
SET data = EXCLUDED.data,
    is_public = true,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

DO $$
DECLARE
  subject_count integer;
BEGIN
  SELECT jsonb_array_length(data)
    INTO subject_count
    FROM public.school_state
   WHERE key = 'stanbax_subjects';
  IF subject_count <> 34 THEN
    RAISE EXCEPTION 'Expected 34 subjects after migration, found %', subject_count;
  END IF;
END;
$$;

COMMIT;
