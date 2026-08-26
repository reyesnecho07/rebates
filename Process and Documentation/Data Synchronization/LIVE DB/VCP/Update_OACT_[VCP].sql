-- Update OACT [VCP_DB]

TRUNCATE TABLE
	VCP_DB.dbo.OACT

INSERT INTO
	VCP_DB.dbo.OACT
SELECT
    *
FROM
    (
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].VCP.dbo.OACT T0
		WHERE
			T0.AcctName LIKE '%Rebate%'

    ) T0