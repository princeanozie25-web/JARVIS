// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "JarvisHumanGateAnchor.generated.h"

class USceneComponent;
class UStaticMeshComponent;

UCLASS(Blueprintable)
class JARVISGAUNTLET_API AJarvisHumanGateAnchor : public AActor
{
	GENERATED_BODY()

public:
	AJarvisHumanGateAnchor();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Metadata")
	FString DomainName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Metadata")
	FString GovernanceRole;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Metadata")
	bool bReadOnlyVisual;

protected:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<USceneComponent> AnchorRoot;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UStaticMeshComponent> PlaceholderMesh;
};
