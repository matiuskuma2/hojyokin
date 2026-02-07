-- 省力化補助金（一般型）第5回公募 詳細データ更新
-- SHORYOKUKA-IPPAN-05

UPDATE subsidy_cache
SET detail_json = json_set(
  detail_json,
  '$.attachments', json('
    {
      "koubo_documents": [
        {
          "name": "再生事業者の定義について",
          "filename": "definition_rehabilitation_business_ippan.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/definition_rehabilitation_business_ippan.pdf",
          "updated_at": "2025-12-19",
          "category": "公募関連"
        },
        {
          "name": "公募要領",
          "filename": "application_rules.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/application_rules.pdf",
          "updated_at": "2026-02-05",
          "category": "公募関連"
        },
        {
          "name": "交付規程との比較表",
          "filename": "rules_comparison.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/rules_comparison.pdf",
          "updated_at": "2026-02-05",
          "category": "公募関連"
        },
        {
          "name": "補助事業の手引き・投資方針",
          "filename": "investment_principle.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/investment_principle.pdf",
          "updated_at": "2025-03-19",
          "category": "公募関連"
        },
        {
          "name": "応募・手続きの手引き（第5回）",
          "filename": "oubo_manual_ippan_05.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/oubo_manual_ippan_05.pdf",
          "updated_at": "2026-01-30",
          "category": "公募関連",
          "is_new": true
        },
        {
          "name": "電子申請マニュアル（第5回）",
          "filename": "electronic_application_manual_ippan_05.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/electronic_application_manual_ippan_05.pdf",
          "updated_at": "2026-01-30",
          "category": "公募関連",
          "is_new": true
        }
      ],
      "application_forms": [
        {
          "name": "1人当たり給与支給総額の確認書",
          "filename": "yoshiki_salary_payment_total_confirmation_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_salary_payment_total_confirmation_ippan.xlsx",
          "updated_at": "2026-01-29",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx",
          "is_new": true
        },
        {
          "name": "役員名簿",
          "filename": "yoshiki_officer_list_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_officer_list_ippan.xlsx",
          "updated_at": "2025-09-19",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "株主・出資者名簿",
          "filename": "yoshiki_shareholder_investor_list_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_shareholder_investor_list_ippan.xlsx",
          "updated_at": "2025-09-19",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "事業実施場所リスト",
          "filename": "yoshiki_project_location_list_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_project_location_list_ippan.xlsx",
          "updated_at": "2025-08-01",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "他の補助金等との重複について",
          "filename": "yoshiki_other_subsidy_usage_record_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_other_subsidy_usage_record_ippan.xlsx",
          "updated_at": "2025-09-19",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "金融機関確認書",
          "filename": "yoshiki_financial_institution_confirmation_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_financial_institution_confirmation_ippan.docx",
          "updated_at": "2025-02-21",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "docx"
        },
        {
          "name": "従業員名簿",
          "filename": "yoshiki_employee_list_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_employee_list_ippan.xlsx",
          "updated_at": "2025-02-21",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "事業場内最低賃金引上げ確認書（第5回）",
          "filename": "yoshiki_on-site_minimum_wage_increase_requirement_ippan_05.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_on-site_minimum_wage_increase_requirement_ippan_05.xlsx",
          "updated_at": "2026-01-15",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx",
          "is_new": true
        },
        {
          "name": "地域別最低賃金引上げ確認書（第5回）",
          "filename": "yoshiki_regional_minimum_wage_increase_requirement_ippan_05.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_regional_minimum_wage_increase_requirement_ippan_05.xlsx",
          "updated_at": "2025-12-19",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "xlsx"
        },
        {
          "name": "サプライチェーン強化枠加点に係る証明書",
          "filename": "yoshiki_supplychain_certificate_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_supplychain_certificate_ippan.docx",
          "updated_at": "2026-02-04",
          "category": "応募申請時に提出が必要な様式",
          "file_type": "docx",
          "is_new": true
        }
      ],
      "business_plan_forms": [
        {
          "name": "事業計画策定の手引き",
          "filename": "business_plan_creation_guidelines_ippan.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/business_plan_creation_guidelines_ippan.pdf",
          "updated_at": "2025-12-19",
          "category": "事業計画策定に係る書類",
          "file_type": "pdf"
        },
        {
          "name": "事業計画書（その1・その2）",
          "filename": "yoshiki_business_plan_part1_part2_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_business_plan_part1_part2_ippan.docx",
          "updated_at": "2025-12-19",
          "category": "事業計画策定に係る書類",
          "file_type": "docx"
        },
        {
          "name": "義務（その1・その2）",
          "filename": "yoshiki_business_plan_duty_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_business_plan_duty_ippan.docx",
          "updated_at": "2025-12-19",
          "category": "事業計画策定に係る書類",
          "file_type": "docx"
        },
        {
          "name": "事業計画書（その3）",
          "filename": "yoshiki_business_plan_part3_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_business_plan_part3_ippan.xlsx",
          "updated_at": "2026-01-23",
          "category": "事業計画策定に係る書類",
          "file_type": "xlsx",
          "is_new": true
        }
      ],
      "grant_application_forms": [
        {
          "name": "参考見積依頼書",
          "filename": "yoshiki_reference_estimation_request_form_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_estimation_request_form_ippan.docx",
          "updated_at": "2025-06-27",
          "category": "交付申請時に提出が必要な資料",
          "file_type": "docx"
        },
        {
          "name": "業者選定理由書",
          "filename": "yoshiki_reference_vendor_selection_reason_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_vendor_selection_reason_ippan.docx",
          "updated_at": "2025-06-27",
          "category": "交付申請時に提出が必要な資料",
          "file_type": "docx"
        },
        {
          "name": "賃上げ表明書",
          "filename": "yoshiki_reference_wage_increase_statement_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_wage_increase_statement_ippan.docx",
          "updated_at": "2025-08-26",
          "category": "交付申請時に提出が必要な資料",
          "file_type": "docx"
        },
        {
          "name": "再生事業者に係る書類",
          "filename": "yoshiki_rehabilitation_docs.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_rehabilitation_docs.docx",
          "updated_at": "2025-06-27",
          "category": "交付申請時に提出が必要な資料",
          "file_type": "docx"
        },
        {
          "name": "旅費に係るガイドライン",
          "filename": "yoshiki_travel_expense_guidelines.pdf",
          "url": "https://shoryokuka.smrj.go.jp/assets/pdf/yoshiki_travel_expense_guidelines.pdf",
          "updated_at": "2025-06-27",
          "category": "交付申請時に提出が必要な資料",
          "file_type": "pdf"
        }
      ],
      "post_approval_forms": [
        {
          "name": "計画変更承認申請書",
          "filename": "yoshiki_plan_change_approval_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_plan_change_approval_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "docx"
        },
        {
          "name": "計画変更経費明細",
          "filename": "yoshiki_plan_change_expense_details_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_plan_change_expense_details_ippan.xlsx",
          "updated_at": "2025-10-23",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "xlsx"
        },
        {
          "name": "計画変更事業計画",
          "filename": "yoshiki_plan_change_business_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_plan_change_business_ippan.xlsx",
          "updated_at": "2025-11-20",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "xlsx"
        },
        {
          "name": "事故報告書",
          "filename": "yoshiki_incident_report_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_incident_report_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "docx"
        },
        {
          "name": "取得財産管理台帳",
          "filename": "yoshiki_asset_management_ledger_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_asset_management_ledger_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "docx"
        },
        {
          "name": "取得財産管理明細",
          "filename": "yoshiki_asset_management_details_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_asset_management_details_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "docx"
        },
        {
          "name": "財産処分承認申請書",
          "filename": "yoshiki_property_disposal_approval_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_property_disposal_approval_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる規程に定める様式",
          "file_type": "docx"
        }
      ],
      "post_approval_reference": [
        {
          "name": "財産管理シール",
          "filename": "property_label_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/property_label_ippan.docx",
          "updated_at": "2025-09-09",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "補助事業実施確認チェックリスト",
          "filename": "subsidy_project_checklist_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/subsidy_project_checklist_ippan.xlsx",
          "updated_at": "2025-11-25",
          "category": "交付決定以降に必要となる資料",
          "file_type": "xlsx"
        },
        {
          "name": "指導・契約に係る参考様式",
          "filename": "yoshiki_reference_guidance_contract.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_guidance_contract.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "専門家任命・就任承諾書",
          "filename": "yoshiki_reference_expert_appointment_acceptance.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_expert_appointment_acceptance.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "専門家活動報告書",
          "filename": "yoshiki_reference_expert_activity_report.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_expert_activity_report.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "旅費明細・受領書",
          "filename": "yoshiki_reference_travel_expense_details_receipt.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_travel_expense_details_receipt.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "宿泊証明書",
          "filename": "yoshiki_reference_accommodation_certificate.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_accommodation_certificate.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "補助経費管理台帳",
          "filename": "yoshiki_reference_subsidy_expense_ledger_ippan.xlsx",
          "url": "https://shoryokuka.smrj.go.jp/assets/xls/yoshiki_reference_subsidy_expense_ledger_ippan.xlsx",
          "updated_at": "2025-10-31",
          "category": "交付決定以降に必要となる資料",
          "file_type": "xlsx"
        },
        {
          "name": "整備・保守に係る参考様式",
          "filename": "yoshiki_reference_maintenance_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/yoshiki_reference_maintenance_ippan.docx",
          "updated_at": "2025-12-19",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "辞退届",
          "filename": "withdrawal_notice_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/withdrawal_notice_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        },
        {
          "name": "交付決定取消承認申請書",
          "filename": "subsidy_cancellation_approval_ippan.docx",
          "url": "https://shoryokuka.smrj.go.jp/assets/doc/subsidy_cancellation_approval_ippan.docx",
          "updated_at": "2025-08-01",
          "category": "交付決定以降に必要となる資料",
          "file_type": "docx"
        }
      ]
    }
  '),
  '$.download_page_url', 'https://shoryokuka.smrj.go.jp/ippan/download/',
  '$.attachments_updated_at', '2026-02-07',
  '$.last_updated', '2026-02-07'
),
detail_score = 85,
wall_chat_ready = 1,
updated_at = datetime('now')
WHERE id = 'SHORYOKUKA-IPPAN-05';
