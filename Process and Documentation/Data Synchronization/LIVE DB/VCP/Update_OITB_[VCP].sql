-- Update OITB [VCP_DB]

TRUNCATE TABLE
    VCP_DB.dbo.OITB

INSERT INTO
    VCP_DB.dbo.OITB
SELECT
    *
FROM
    (
		SELECT
			T0.ItmsGrpCod,
			T0.ItmsGrpNam
		FROM
			[192.168.11.103].VCP.dbo.OITB T0

    ) T0