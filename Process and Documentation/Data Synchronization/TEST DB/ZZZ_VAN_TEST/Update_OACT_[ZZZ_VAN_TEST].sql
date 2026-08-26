-- Update OACT [ZZZ_VAN_DB]

TRUNCATE TABLE
	ZZZ_VAN_DB.dbo.OACT

INSERT INTO
    ZZZ_VAN_DB.dbo.OACT
SELECT
    *
FROM
    (
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].ZZZ_VAN_TEST.dbo.OACT T0
		WHERE
			T0.AcctName LIKE '%Rebate%'

    ) T0