-- Update OITB [VAN_DB]

TRUNCATE TABLE
    VAN_DB.dbo.OITB

INSERT INTO
    VAN_DB.dbo.OITB
SELECT
    *
FROM
    (
		SELECT
			T0.ItmsGrpCod,
			T0.ItmsGrpNam
		FROM
			[192.168.11.103].VAN.dbo.OITB T0

    ) T0