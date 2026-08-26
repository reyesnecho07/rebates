-- AP036

-- AP036 : BP Code must not be empty. -NGR - 08/12/2026
-- Remarks: To restrict the transaction if the BP Code is empty and the Account Name is Rebate.
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
				LEFT JOIN OACT T2 ON T1.AcctCode = T2.AcctCode
				LEFT JOIN OUSR JA0 ON ISNULL(T0.UserSign2,T0.UserSign) = JA0.UserID
				LEFT JOIN OUDP JA1 ON JA0.Department = JA1.Code
			WHERE
				T0.DocEntry = @list_of_cols_val_tab_del
				AND T2.AcctName LIKE '%Rebate%'
				AND ISNULL(T0.U_BP_Code, '') = ''
				AND 'AP036' IN
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
					-- list of active Users in AP036
					(
						SELECT
							JB0.U_SAP_ID
						FROM
							#SP_USERS_TempTable JB0
						WHERE
							JB0.U_SP_Code = 'AP036'
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
					-- list of active Users/departments in AP036
					(
						SELECT
							JB0.U_SAP_ID
						FROM
							#SP_USERS_TempTable JB0
						WHERE
							JB0.U_SP_Code = 'AP036'
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
				@error_message = 'AP036 : BP Code must not be empty.'
			END
	END