// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "JarvisUniverseFoundationActor.generated.h"

class UCameraComponent;
class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UPointLightComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

USTRUCT(BlueprintType)
struct FJarvisGalaxyAnchor
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	FName DomainName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	FVector Location;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	FLinearColor DomainColor;
};

UCLASS(Blueprintable)
class JARVISGAUNTLET_API AJarvisUniverseFoundationActor : public AActor
{
	GENERATED_BODY()

public:
	AJarvisUniverseFoundationActor();

	virtual void OnConstruction(const FTransform& Transform) override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	FString UniverseName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	bool bReadOnlyVisual;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	float GalaxyAnchorDistance;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	int32 StarCount;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	float StarfieldRadius;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "JARVIS|Universe")
	TArray<FJarvisGalaxyAnchor> GalaxyAnchors;

protected:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<USceneComponent> UniverseRoot;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UInstancedStaticMeshComponent> StarfieldInstances;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UInstancedStaticMeshComponent> GalaxyAnchorInstances;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UStaticMeshComponent> HumanGateReserveMarker;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UTextRenderComponent> HumanGateReserveLabel;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TArray<TObjectPtr<UTextRenderComponent>> GalaxyLabels;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UCameraComponent> OverviewCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JARVIS|Visual")
	TObjectPtr<UPointLightComponent> ChamberLight;

	UPROPERTY(Transient)
	TObjectPtr<UStaticMesh> SphereMesh;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInterface> EmissiveMaterial;

private:
	void ConfigureGalaxyAnchors();
	void ConfigureLabels();
	void BuildStarfield();
	void BuildGalaxyAnchors();
};
