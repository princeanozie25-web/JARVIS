// Copyright Epic Games, Inc. All Rights Reserved.

#include "JarvisHumanGateAnchor.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"

AJarvisHumanGateAnchor::AJarvisHumanGateAnchor()
{
	PrimaryActorTick.bCanEverTick = false;

	DomainName = TEXT("Human Gate");
	GovernanceRole = TEXT("Approval lifecycle visual anchor");
	bReadOnlyVisual = true;

	AnchorRoot = CreateDefaultSubobject<USceneComponent>(TEXT("HumanGateRoot"));
	SetRootComponent(AnchorRoot);

	PlaceholderMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HumanGatePlaceholder"));
	PlaceholderMesh->SetupAttachment(AnchorRoot);
	PlaceholderMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PlaceholderMesh->SetRelativeScale3D(FVector(1.5f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMesh.Succeeded())
	{
		PlaceholderMesh->SetStaticMesh(SphereMesh.Object);
	}
}
