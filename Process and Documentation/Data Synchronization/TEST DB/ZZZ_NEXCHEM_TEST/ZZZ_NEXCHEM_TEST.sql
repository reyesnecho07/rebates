-- Update OACT
TRUNCATE TABLE
   ZZZ_NEXCHEM_DB.dbo.OACT

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OACT
SELECT
    *
FROM
    (
		SELECT
			T0.AcctCode,
			T0.AcctName
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OACT T0
		WHERE
			T0.AcctName LIKE '%Rebate%'

    ) T0
	

-- Update OCRD
TRUNCATE TABLE
    ZZZ_NEXCHEM_DB.dbo.OCRD

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OCRD
SELECT
    *
FROM
    (
		SELECT
			T0.CardCode,
			T0.CardName,
			T0.GroupCode,
			T0.SlpCode
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OCRD T0
		WHERE
            T0.CardType = 'C'

    ) T0


-- Update OCRG
TRUNCATE TABLE
	ZZZ_NEXCHEM_DB.dbo.OCRG

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OCRG
SELECT
    *
FROM
    (
		SELECT
			T0.GroupCode,
			T0.GroupName
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OCRG T0
			
    ) T0


-- Update OITB
TRUNCATE TABLE
    ZZZ_NEXCHEM_DB.dbo.OITB

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OITB
SELECT
    *
FROM
    (
		SELECT
			T0.ItmsGrpCod,
			T0.ItmsGrpNam
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OITB T0

    ) T0


-- Update OITM
TRUNCATE TABLE
	ZZZ_NEXCHEM_DB.dbo.OITM

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OITM
SELECT
    *
FROM
    (
		SELECT
			T0.ItemCode,
			T0.ItemName,
			T0.ItmsGrpCod
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OITM T0
		WHERE
			(
				NOT
				(
					-- This is used for getting inactive Item, but it has 'NOT' in 'AND' so that it gets an active Item.
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND T0.frozenTo > CAST(GETDATE() AS DATE)
						AND ISNULL(T0.frozenTo, '') <> ''
					)
					OR
					(
						T0.validFor = 'Y'
						AND T0.frozenFor = 'N'
						AND T0.validTo < CAST(GETDATE() AS DATE)
						AND ISNULL(T0.validTo, '') <> ''
					)
					OR
					(
						T0.validFor = 'N'
						AND T0.frozenFor = 'Y'
						AND ISNULL(T0.frozenTo, '') = ''
					)
				)
				OR
				T0.ItemCode IN
				(
					SELECT DISTINCT
						A1.ItemCode
					FROM
						ZZZ_NEXCHEM_DB.dbo.FixProdRebate A1

					UNION

					SELECT DISTINCT
						A2.ItemCode
					FROM
						ZZZ_NEXCHEM_DB.dbo.IncItemRebate A2

					UNION

					SELECT DISTINCT
						A3.ItemCode
					FROM
						ZZZ_NEXCHEM_DB.dbo.PerProdRebate A3
				)
			)
    ) T0


-- Update OSLP
TRUNCATE TABLE
	ZZZ_NEXCHEM_DB.dbo.OSLP

INSERT INTO
    ZZZ_NEXCHEM_DB.dbo.OSLP
SELECT
    *
FROM
    (
		SELECT
			T0.SlpCode,
			T0.SlpName
		FROM
			[192.168.11.103].ZZZ_NEXCHEM_TEST.dbo.OSLP T0
		WHERE
			(
				T0.Active = 'Y'
				OR
				T0.SlpCode IN
				(
					SELECT
						A0.SlpCode
					FROM
						ZZZ_NEXCHEM_DB.dbo.RebateProgram A0
				)
			)

    ) T0