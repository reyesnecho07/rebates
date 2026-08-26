-- Update OACT [VAN_DB]

TRUNCATE TABLE
	VAN_DB.dbo.OACT

INSERT INTO
	VAN_DB.dbo.OACT
SELECT
    *
FROM
    (
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].VAN.dbo.OACT T0
		WHERE
			T0.AcctName LIKE '%Rebate%'

    ) T0