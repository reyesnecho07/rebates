-- AP037

-- AP037 : Amount must not exceed the customer's Rebate Balance. -NGR - 08/12/2026
-- Remarks: To restrict the transaction if the amount released exceeds the customer's Rebate Balance.
-- Setup: Rebate WebDev
IF @object_type = '18' AND @transaction_type IN ('A', 'U')
	BEGIN
		IF EXISTS 
		(
			SELECT
				1
			FROM
				OPCH T0
				INNER JOIN PCH1 T1 ON T0.DocEntry = T1.DocEntry
				LEFT JOIN OACT T2 ON T1.AcctCode = T2.AcctCode AND T2.AcctName LIKE '%Rebate%'
				LEFT JOIN OUSR JA0 ON ISNULL(T0.UserSign2,T0.UserSign) = JA0.UserID
				LEFT JOIN OUDP JA1 ON JA0.Department = JA1.Code
			WHERE
				T0.DocEntry = @list_of_cols_val_tab_del
				AND T0.DocTotal >
				ISNULL
				(
					(
						SELECT
							SUM(PH.Rebatebalance)
						FROM
							[192.168.100.100].[ZZZ_VCP_DB].[dbo].[PayoutHistory] PH
						WHERE
							PH.CardCode = T0.U_BP_Code
					),
					0
				)

				AND 'AP037' IN
				( -- to check if SP Code is Active
					SELECT
						JB0.Code
					FROM
						#SP_CODE_TempTable JB0
					WHERE
						JB0.U_Status = 'Active'
				)
				AND 
				( -- if User is not Authorized (SP Code)
					JA0.USER_CODE NOT IN
					-- list of active Users in AP037
					(
						SELECT
							JB0.U_SAP_ID
						FROM
							#SP_USERS_TempTable JB0
						WHERE
							JB0.U_SP_Code = 'AP037'
							AND
							(
								JB0.U_Start IS NULL
								OR DATEDIFF(day,JB0.U_Start, GetDate()) >= 0
							)
							AND
							(
								JB0.U_End IS NULL
								OR DATEDIFF(day,GetDate(),JB0.U_End) >= 0
							)
					)
				)
				AND
				( -- if Department is not Authorized (SP Code)
					JA1.Name NOT IN
					-- list of active Users/departments in AP037
					(
						SELECT
							JB0.U_SAP_ID
						FROM
							#SP_USERS_TempTable JB0
						WHERE
							JB0.U_SP_Code = 'AP037'
							AND
							(
								JB0.U_Start IS NULL
								OR DATEDIFF(day,JB0.U_Start, GetDate()) >= 0
							)
							AND
							(
								JB0.U_End IS NULL
								OR DATEDIFF(day,GetDate(),JB0.U_End) >= 0
							)
					)
				)
		)
			BEGIN
				SELECT @Error = 1,
				@error_message = 'AP037 : Amount must not exceed the customer''s Rebate Balance.'
			END
	END