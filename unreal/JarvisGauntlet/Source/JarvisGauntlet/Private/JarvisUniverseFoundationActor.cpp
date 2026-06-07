// Copyright Epic Games, Inc. All Rights Reserved.

#include "JarvisUniverseFoundationActor.h"

#include "Camera/CameraComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr int32 AnchorCount = 6;

	FName AnchorComponentName(int32 Index)
	{
		return FName(*FString::Printf(TEXT("GalaxyLabel_%d"), Index));
	}
}

AJarvisUniverseFoundationActor::AJarvisUniverseFoundationActor()
{
	PrimaryActorTick.bCanEverTick = false;

	UniverseName = TEXT("Universe_01");
	bReadOnlyVisual = true;
	GalaxyAnchorDistance = 72000.0f;
	StarCount = 420;
	StarfieldRadius = 155000.0f;

	UniverseRoot = CreateDefaultSubobject<USceneComponent>(TEXT("UniverseRoot"));
	SetRootComponent(UniverseRoot);

	StarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("VoidStarfield"));
	StarfieldInstances->SetupAttachment(UniverseRoot);
	StarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	GalaxyAnchorInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("FutureGalaxyAnchors"));
	GalaxyAnchorInstances->SetupAttachment(UniverseRoot);
	GalaxyAnchorInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	HumanGateReserveMarker = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HumanGateReserveMarker"));
	HumanGateReserveMarker->SetupAttachment(UniverseRoot);
	HumanGateReserveMarker->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HumanGateReserveMarker->SetRelativeScale3D(FVector(6.0f));

	HumanGateReserveLabel = CreateDefaultSubobject<UTextRenderComponent>(TEXT("HumanGateReserveLabel"));
	HumanGateReserveLabel->SetupAttachment(UniverseRoot);
	HumanGateReserveLabel->SetText(FText::FromString(TEXT("Human Gate Reserve")));
	HumanGateReserveLabel->SetHorizontalAlignment(EHTA_Center);
	HumanGateReserveLabel->SetTextRenderColor(FColor(120, 210, 255));
	HumanGateReserveLabel->SetWorldSize(1400.0f);
	HumanGateReserveLabel->SetRelativeLocation(FVector(0.0f, 0.0f, 2800.0f));
	HumanGateReserveLabel->SetRelativeRotation(FRotator(62.0f, 0.0f, 0.0f));

	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		UTextRenderComponent* Label = CreateDefaultSubobject<UTextRenderComponent>(AnchorComponentName(Index));
		Label->SetupAttachment(UniverseRoot);
		Label->SetHorizontalAlignment(EHTA_Center);
		Label->SetTextRenderColor(FColor(150, 210, 255));
		Label->SetWorldSize(1800.0f);
		GalaxyLabels.Add(Label);
	}

	OverviewCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("OverviewCamera"));
	OverviewCamera->SetupAttachment(UniverseRoot);
	OverviewCamera->SetRelativeLocation(FVector(-88000.0f, -76000.0f, 42000.0f));
	OverviewCamera->SetRelativeRotation(FRotator(-24.0f, 42.0f, 0.0f));
	OverviewCamera->SetFieldOfView(62.0f);

	ChamberLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("VoidScaleReferenceLight"));
	ChamberLight->SetupAttachment(UniverseRoot);
	ChamberLight->SetIntensity(9000.0f);
	ChamberLight->SetAttenuationRadius(140000.0f);
	ChamberLight->SetLightColor(FLinearColor(0.20f, 0.55f, 1.0f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMeshFinder(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMeshFinder.Succeeded())
	{
		SphereMesh = SphereMeshFinder.Object;
		StarfieldInstances->SetStaticMesh(SphereMesh);
		GalaxyAnchorInstances->SetStaticMesh(SphereMesh);
		HumanGateReserveMarker->SetStaticMesh(SphereMesh);
	}

	static ConstructorHelpers::FObjectFinder<UMaterialInterface> EmissiveMaterialFinder(TEXT("/Engine/EngineMaterials/EmissiveMeshMaterial.EmissiveMeshMaterial"));
	if (EmissiveMaterialFinder.Succeeded())
	{
		EmissiveMaterial = EmissiveMaterialFinder.Object;
		StarfieldInstances->SetMaterial(0, EmissiveMaterial);
		GalaxyAnchorInstances->SetMaterial(0, EmissiveMaterial);
		HumanGateReserveMarker->SetMaterial(0, EmissiveMaterial);
	}

	ConfigureGalaxyAnchors();
	ConfigureLabels();
}

void AJarvisUniverseFoundationActor::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);

	ConfigureGalaxyAnchors();
	ConfigureLabels();
	BuildStarfield();
	BuildGalaxyAnchors();
}

void AJarvisUniverseFoundationActor::ConfigureGalaxyAnchors()
{
	const TArray<FName> DomainNames = {
		TEXT("Space"),
		TEXT("Time"),
		TEXT("Mind"),
		TEXT("Soul"),
		TEXT("Reality"),
		TEXT("Power"),
	};

	const TArray<FLinearColor> DomainColors = {
		FLinearColor(0.20f, 0.50f, 1.00f),
		FLinearColor(0.10f, 0.85f, 0.95f),
		FLinearColor(0.70f, 0.35f, 1.00f),
		FLinearColor(1.00f, 0.35f, 0.70f),
		FLinearColor(0.25f, 1.00f, 0.45f),
		FLinearColor(1.00f, 0.62f, 0.16f),
	};

	GalaxyAnchors.Reset();
	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		const float AngleRadians = FMath::DegreesToRadians(60.0f * static_cast<float>(Index));
		const float HeightOffset = (Index % 2 == 0) ? 5500.0f : -3500.0f;

		FJarvisGalaxyAnchor Anchor;
		Anchor.DomainName = DomainNames[Index];
		Anchor.Location = FVector(
			FMath::Cos(AngleRadians) * GalaxyAnchorDistance,
			FMath::Sin(AngleRadians) * GalaxyAnchorDistance,
			HeightOffset);
		Anchor.DomainColor = DomainColors[Index];
		GalaxyAnchors.Add(Anchor);
	}
}

void AJarvisUniverseFoundationActor::ConfigureLabels()
{
	for (int32 Index = 0; Index < GalaxyLabels.Num() && Index < GalaxyAnchors.Num(); ++Index)
	{
		UTextRenderComponent* Label = GalaxyLabels[Index];
		if (!Label)
		{
			continue;
		}

		const FJarvisGalaxyAnchor& Anchor = GalaxyAnchors[Index];
		Label->SetText(FText::FromName(Anchor.DomainName));
		Label->SetRelativeLocation(Anchor.Location + FVector(0.0f, 0.0f, 5200.0f));
		Label->SetRelativeRotation(FRotator(60.0f, 0.0f, 0.0f));
	}
}

void AJarvisUniverseFoundationActor::BuildStarfield()
{
	if (!StarfieldInstances || !SphereMesh)
	{
		return;
	}

	StarfieldInstances->ClearInstances();

	FRandomStream RandomStream(210501);
	for (int32 Index = 0; Index < StarCount; ++Index)
	{
		const FVector Direction = RandomStream.GetUnitVector();
		const float Radius = RandomStream.FRandRange(18000.0f, StarfieldRadius);
		const FVector Location = Direction * Radius;
		const float Scale = RandomStream.FRandRange(0.35f, 2.2f);

		FTransform InstanceTransform;
		InstanceTransform.SetLocation(Location);
		InstanceTransform.SetScale3D(FVector(Scale * 95.0f));
		StarfieldInstances->AddInstance(InstanceTransform);
	}
}

void AJarvisUniverseFoundationActor::BuildGalaxyAnchors()
{
	if (!GalaxyAnchorInstances || !SphereMesh)
	{
		return;
	}

	GalaxyAnchorInstances->ClearInstances();

	for (const FJarvisGalaxyAnchor& Anchor : GalaxyAnchors)
	{
		FTransform AnchorTransform;
		AnchorTransform.SetLocation(Anchor.Location);
		AnchorTransform.SetScale3D(FVector(18.0f));
		GalaxyAnchorInstances->AddInstance(AnchorTransform);
	}
}
