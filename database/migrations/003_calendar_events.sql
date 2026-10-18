-- Academic calendar events (A.Y. 2026–2027)
USE pup_col_sc;

CREATE TABLE IF NOT EXISTS calendar_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(191) NOT NULL,
  kind ENUM('holiday', 'exam', 'enrollment', 'academic') NOT NULL DEFAULT 'academic',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_calendar_events_slug (slug),
  KEY idx_calendar_events_dates (start_date, end_date),
  KEY idx_calendar_events_kind (kind),
  KEY idx_calendar_events_published (is_published, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO calendar_events
  (slug, kind, title, description, start_date, end_date, sort_order, is_published)
VALUES
  (
    'encoding-1',
    'academic',
    'Encoding of subject offerings',
    'Subjects for the coming term are encoded before enrollment opens.',
    '2026-05-18',
    '2026-05-22',
    1,
    1
  ),
  (
    'enroll-1st',
    'enrollment',
    'First year onsite enrollment',
    'First-year students enroll onsite at the College of Law.',
    '2026-06-01',
    '2026-06-30',
    2,
    1
  ),
  (
    'independence',
    'holiday',
    'Independence Day',
    'Regular holiday. No classes.',
    '2026-06-12',
    '2026-06-12',
    3,
    1
  ),
  (
    'col-council-jun',
    'academic',
    'COL special academic council',
    'The College of Law academic council meets on this date.',
    '2026-06-15',
    '2026-06-15',
    4,
    1
  ),
  (
    'enroll-2nd-a',
    'enrollment',
    'Second year onsite enrollment',
    'Second-year students enroll onsite.',
    '2026-06-19',
    '2026-06-19',
    5,
    1
  ),
  (
    'enroll-2nd-b',
    'enrollment',
    'Second year onsite enrollment',
    'Second-year students enroll onsite.',
    '2026-06-22',
    '2026-06-22',
    6,
    1
  ),
  (
    'enroll-34',
    'enrollment',
    'Third and fourth year enrollment',
    'Third-year and fourth-year students enroll onsite.',
    '2026-06-23',
    '2026-06-23',
    7,
    1
  ),
  (
    'manila-2026',
    'holiday',
    'Manila Day',
    'City holiday in Manila. No classes.',
    '2026-06-24',
    '2026-06-24',
    8,
    1
  ),
  (
    'commencement-jun',
    'academic',
    'Year-end commencement exercises',
    'Year-end graduation rites for the College of Law.',
    '2026-06-25',
    '2026-06-26',
    9,
    1
  ),
  (
    'enroll-irregular',
    'enrollment',
    'Irregular students enrollment',
    'Students with an irregular load enroll onsite.',
    '2026-06-29',
    '2026-07-01',
    10,
    1
  ),
  (
    'univ-council',
    'academic',
    'University academic council',
    'The university academic council meets on this date.',
    '2026-06-30',
    '2026-06-30',
    11,
    1
  ),
  (
    'adjust-jul',
    'academic',
    'Adjustment period',
    'Students may add or drop subjects during this period.',
    '2026-07-02',
    '2026-07-03',
    12,
    1
  ),
  (
    'faculty-jul',
    'academic',
    'Faculty meeting',
    'Faculty meet before classes begin.',
    '2026-07-04',
    '2026-07-04',
    13,
    1
  ),
  (
    'sem1-start',
    'academic',
    'First semester starts',
    'Classes for the first semester begin.',
    '2026-07-08',
    '2026-07-08',
    14,
    1
  ),
  (
    'orientation-jul',
    'academic',
    'Student orientation',
    'Incoming students are oriented on college policies and schedules.',
    '2026-07-08',
    '2026-07-11',
    15,
    1
  ),
  (
    'tuition-jul',
    'academic',
    'Last day to pay tuition and fees',
    'Deadline to settle tuition and fees for the semester.',
    '2026-07-23',
    '2026-07-23',
    16,
    1
  ),
  (
    'withdraw-jul',
    'academic',
    'Last day to file a withdrawal',
    'Last day a student may file a withdrawal for the term.',
    '2026-07-23',
    '2026-07-23',
    17,
    1
  ),
  (
    'commencement-aug',
    'academic',
    'University year-end commencement',
    'University-wide year-end graduation rites.',
    '2026-08-18',
    '2026-08-20',
    18,
    1
  ),
  (
    'heroes',
    'holiday',
    'National Heroes Day',
    'Regular holiday. No classes.',
    '2026-08-31',
    '2026-08-31',
    19,
    1
  ),
  (
    'bar-1',
    'exam',
    'Bar examinations, day 1',
    'First day of the bar examinations.',
    '2026-09-06',
    '2026-09-06',
    20,
    1
  ),
  (
    'bar-2',
    'exam',
    'Bar examinations, day 2',
    'Second day of the bar examinations.',
    '2026-09-09',
    '2026-09-09',
    21,
    1
  ),
  (
    'bar-3',
    'exam',
    'Bar examinations, day 3',
    'Third day of the bar examinations.',
    '2026-09-13',
    '2026-09-13',
    22,
    1
  ),
  (
    'midterm-1',
    'exam',
    'Midterm examinations',
    'Midterm examinations for the first semester.',
    '2026-09-18',
    '2026-09-24',
    23,
    1
  ),
  (
    'midyear-filing',
    'academic',
    'Mid-year graduation filing',
    'Students file for mid-year graduation within this period.',
    '2026-09-30',
    '2026-10-15',
    24,
    1
  ),
  (
    'thesis',
    'exam',
    'Thesis defense',
    'Scheduled defense for thesis candidates.',
    '2026-10-10',
    '2026-10-11',
    25,
    1
  ),
  (
    'encoding-oct',
    'academic',
    'Encoding of subject offerings',
    'Subjects for the next term are encoded before enrollment.',
    '2026-10-16',
    '2026-10-20',
    26,
    1
  ),
  (
    'all-saints',
    'holiday',
    'All Saints'' Day',
    'Regular holiday. No classes.',
    '2026-11-01',
    '2026-11-01',
    27,
    1
  ),
  (
    'all-souls',
    'holiday',
    'All Souls'' Day',
    'Special non-working day. No classes.',
    '2026-11-02',
    '2026-11-02',
    28,
    1
  ),
  (
    'finals-1',
    'exam',
    'Final examinations',
    'Final examinations for the first semester.',
    '2026-11-06',
    '2026-11-12',
    29,
    1
  ),
  (
    'sem1-end',
    'academic',
    'End of first semester',
    'Last day of classes for the first semester.',
    '2026-11-12',
    '2026-11-12',
    30,
    1
  ),
  (
    'grades-1',
    'academic',
    'Encoding of grades',
    'Faculty encode grades after the final examinations.',
    '2026-11-13',
    '2026-11-19',
    31,
    1
  ),
  (
    'grade-sheets-1',
    'academic',
    'Submission of grade sheets',
    'Grade sheets are submitted to the college.',
    '2026-11-20',
    '2026-11-21',
    32,
    1
  ),
  (
    'enroll-nov-1',
    'enrollment',
    'First year onsite enrollment',
    'First-year students enroll onsite for the second semester.',
    '2026-11-23',
    '2026-11-23',
    33,
    1
  ),
  (
    'enroll-nov-2',
    'enrollment',
    'Second year onsite enrollment',
    'Second-year students enroll onsite for the second semester.',
    '2026-11-24',
    '2026-11-24',
    34,
    1
  ),
  (
    'enroll-nov-34',
    'enrollment',
    'Third and fourth year enrollment',
    'Third-year and fourth-year students enroll onsite for the second semester.',
    '2026-11-25',
    '2026-11-25',
    35,
    1
  ),
  (
    'enroll-nov-irr',
    'enrollment',
    'Irregular students enrollment',
    'Students with an irregular load enroll for the second semester.',
    '2026-11-26',
    '2026-11-27',
    36,
    1
  ),
  (
    'faculty-nov',
    'academic',
    'Faculty meeting',
    'Faculty meet before the second semester begins.',
    '2026-11-28',
    '2026-11-28',
    37,
    1
  ),
  (
    'bonifacio',
    'holiday',
    'Bonifacio Day',
    'Regular holiday. No classes.',
    '2026-11-30',
    '2026-11-30',
    38,
    1
  ),
  (
    'sem2-start',
    'academic',
    'Second semester starts',
    'Classes for the second semester begin.',
    '2026-12-02',
    '2026-12-02',
    39,
    1
  ),
  (
    'adjust-dec',
    'academic',
    'Adjustment period',
    'Students may add or drop subjects during this period.',
    '2026-12-01',
    '2026-12-04',
    40,
    1
  ),
  (
    'orientation-dec',
    'academic',
    'Student orientation',
    'Students are oriented at the start of the second semester.',
    '2026-12-02',
    '2026-12-04',
    41,
    1
  ),
  (
    'immaculate',
    'holiday',
    'Feast of the Immaculate Conception',
    'Regular holiday. No classes.',
    '2026-12-08',
    '2026-12-08',
    42,
    1
  ),
  (
    'pupclee-app-1',
    'exam',
    'PUPCLEE batch 1 application',
    'Application opens for the first batch of the College of Law entrance exam.',
    '2026-12-09',
    '2026-12-09',
    43,
    1
  ),
  (
    'tuition-dec',
    'academic',
    'Last day to pay tuition and fees',
    'Deadline to settle tuition and fees for the second semester.',
    '2026-12-17',
    '2026-12-17',
    44,
    1
  ),
  (
    'withdraw-dec',
    'academic',
    'Last day to file a withdrawal',
    'Last day a student may file a withdrawal for the second semester.',
    '2026-12-17',
    '2026-12-17',
    45,
    1
  ),
  (
    'christmas-break',
    'holiday',
    'Christmas vacation',
    'Classes are suspended for the Christmas vacation.',
    '2026-12-20',
    '2027-01-03',
    46,
    1
  ),
  (
    'christmas-eve',
    'holiday',
    'Christmas Eve',
    'Holiday. No classes.',
    '2026-12-24',
    '2026-12-24',
    47,
    1
  ),
  (
    'christmas',
    'holiday',
    'Christmas Day',
    'Regular holiday. No classes.',
    '2026-12-25',
    '2026-12-25',
    48,
    1
  ),
  (
    'rizal',
    'holiday',
    'Rizal Day',
    'Regular holiday. No classes.',
    '2026-12-30',
    '2026-12-30',
    49,
    1
  ),
  (
    'nye',
    'holiday',
    'New Year''s Eve',
    'Holiday. No classes.',
    '2026-12-31',
    '2026-12-31',
    50,
    1
  ),
  (
    'nyd',
    'holiday',
    'New Year''s Day',
    'Regular holiday. No classes.',
    '2027-01-01',
    '2027-01-01',
    51,
    1
  ),
  (
    'classes-resume',
    'academic',
    'Classes resume',
    'Classes resume after the Christmas vacation.',
    '2027-01-04',
    '2027-01-04',
    52,
    1
  ),
  (
    'pupclee-deadline',
    'exam',
    'PUPCLEE batch 1 application deadline',
    'Last day to apply for the first batch of the entrance exam.',
    '2027-01-22',
    '2027-01-22',
    53,
    1
  ),
  (
    'lunar',
    'holiday',
    'Lunar New Year',
    'Special non-working day. No classes.',
    '2027-02-06',
    '2027-02-06',
    54,
    1
  ),
  (
    'pupclee-written-1',
    'exam',
    'PUPCLEE batch 1 written exam',
    'Written entrance examination for the first batch.',
    '2027-02-07',
    '2027-02-07',
    55,
    1
  ),
  (
    'midterm-2',
    'exam',
    'Midterm examinations',
    'Midterm examinations for the second semester.',
    '2027-02-18',
    '2027-02-23',
    56,
    1
  ),
  (
    'yearend-filing',
    'academic',
    'Year-end graduation filing',
    'Students file for year-end graduation within this period.',
    '2027-02-17',
    '2027-02-28',
    57,
    1
  ),
  (
    'edsa',
    'holiday',
    'EDSA Revolution anniversary',
    'Holiday observance. No classes.',
    '2027-02-25',
    '2027-02-25',
    58,
    1
  ),
  (
    'pupclee-app-2',
    'exam',
    'PUPCLEE batch 2 application',
    'Application opens for the second batch of the entrance exam.',
    '2027-03-01',
    '2027-03-01',
    59,
    1
  ),
  (
    'pupclee-interview-1',
    'exam',
    'PUPCLEE batch 1 interview',
    'Interview schedule for the first batch of entrance examinees.',
    '2027-03-06',
    '2027-03-07',
    60,
    1
  ),
  (
    'eid',
    'holiday',
    'Eid al-Fitr',
    'Regular holiday. No classes.',
    '2027-03-10',
    '2027-03-10',
    61,
    1
  ),
  (
    'pupclee-results-1',
    'exam',
    'PUPCLEE batch 1 results',
    'Results are released for the first batch of the entrance exam.',
    '2027-03-22',
    '2027-03-22',
    62,
    1
  ),
  (
    'maundy',
    'holiday',
    'Maundy Thursday',
    'Regular holiday. No classes.',
    '2027-03-25',
    '2027-03-25',
    63,
    1
  ),
  (
    'good-friday',
    'holiday',
    'Good Friday',
    'Regular holiday. No classes.',
    '2027-03-26',
    '2027-03-26',
    64,
    1
  ),
  (
    'black-saturday',
    'holiday',
    'Black Saturday',
    'Holiday. No classes.',
    '2027-03-27',
    '2027-03-27',
    65,
    1
  ),
  (
    'pupclee-permits',
    'exam',
    'PUPCLEE batch 2 permits',
    'Examination permits are released for the second batch.',
    '2027-03-29',
    '2027-03-29',
    66,
    1
  ),
  (
    'kagitingan',
    'holiday',
    'Araw ng Kagitingan',
    'Regular holiday. No classes.',
    '2027-04-09',
    '2027-04-09',
    67,
    1
  ),
  (
    'finals-grad',
    'exam',
    'Finals, graduating students',
    'Final examinations for graduating students.',
    '2027-04-15',
    '2027-04-21',
    68,
    1
  ),
  (
    'grades-grad',
    'academic',
    'Encoding of graduating grades',
    'Faculty encode grades of graduating students.',
    '2027-04-22',
    '2027-04-23',
    69,
    1
  ),
  (
    'pupclee-docs',
    'exam',
    'PUPCLEE batch 2 document deadline',
    'Deadline to submit documents for the second batch of the entrance exam.',
    '2027-04-23',
    '2027-04-23',
    70,
    1
  ),
  (
    'finals-nongrad',
    'exam',
    'Finals, non-graduating students',
    'Final examinations for students who are not graduating.',
    '2027-04-22',
    '2027-04-28',
    71,
    1
  ),
  (
    'sem2-end',
    'academic',
    'Second semester ends',
    'Last day of classes for the second semester.',
    '2027-04-28',
    '2027-04-28',
    72,
    1
  ),
  (
    'grades-nongrad',
    'academic',
    'Encoding of non-graduating grades',
    'Faculty encode grades of non-graduating students.',
    '2027-05-03',
    '2027-05-05',
    73,
    1
  ),
  (
    'grade-sheets-2',
    'academic',
    'Submission of grade sheets',
    'Grade sheets for the second semester are submitted.',
    '2027-05-06',
    '2027-05-14',
    74,
    1
  ),
  (
    'pupclee-written-2',
    'exam',
    'PUPCLEE batch 2 written exam',
    'Written entrance examination for the second batch.',
    '2027-05-09',
    '2027-05-09',
    75,
    1
  ),
  (
    'pupclee-interview-2',
    'exam',
    'PUPCLEE batch 2 interview',
    'Interview schedule for the second batch of entrance examinees.',
    '2027-05-29',
    '2027-05-30',
    76,
    1
  ),
  (
    'pupclee-results-2',
    'exam',
    'PUPCLEE batch 2 results',
    'Results are released for the second batch of the entrance exam.',
    '2027-06-07',
    '2027-06-07',
    77,
    1
  ),
  (
    'col-council-jun27',
    'academic',
    'COL special academic council',
    'The College of Law academic council meets on this date.',
    '2027-06-18',
    '2027-06-18',
    78,
    1
  ),
  (
    'manila-2027',
    'holiday',
    'Manila Day',
    'City holiday in Manila. No classes.',
    '2027-06-24',
    '2027-06-24',
    79,
    1
  ),
  (
    'commencement-jun27',
    'academic',
    'Year-end commencement exercises',
    'Year-end graduation rites for the College of Law.',
    '2027-06-28',
    '2027-06-29',
    80,
    1
  )
ON DUPLICATE KEY UPDATE
  kind = VALUES(kind),
  title = VALUES(title),
  description = VALUES(description),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  sort_order = VALUES(sort_order),
  is_published = VALUES(is_published);
