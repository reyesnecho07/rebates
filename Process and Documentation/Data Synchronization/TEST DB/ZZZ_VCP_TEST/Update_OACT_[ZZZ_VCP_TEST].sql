-- Update OACT [ZZZ_VCP_DB]

TRUNCATE TABLE
	ZZZ_VCP_DB.dbo.OACT

INSERT INTO
    ZZZ_VCP_DB.dbo.OACT
SELECT
    *
FROM
    (
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].ZZZ_VCP_TEST.dbo.OACT T0
		WHERE
			T0.AcctName LIKE '%Rebate%'

    ) T0