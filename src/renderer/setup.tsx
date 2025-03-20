import { useState, useEffect } from "react";
import { Button } from "./ui/button";

// Étapes de l'installation
enum SetupStep {
  WELCOME = "welcome",
  PERMISSIONS = "permissions",
  AUTHENTICATION = "authentication",
  COMPLETE = "complete",
}

// Composant principal d'installation
const SetupWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.WELCOME);
  const [permissionsStatus, setPermissionsStatus] = useState<boolean>(false);
  const [_, setDirectoriesCreated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    isAuthenticated: boolean;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    user?: any;
  }>({ isAuthenticated: false });

  useEffect(() => {
    if (currentStep === SetupStep.PERMISSIONS) {
      checkPermissions();
    } else if (currentStep === SetupStep.AUTHENTICATION) {
      checkAuthentication();
    }

    const unsubscribeAuth = window.electronAPI?.auth.onSuccess((auth) => {
      setAuthStatus({ isAuthenticated: Boolean(auth), user: auth?.token });
    });

    return () => {
      unsubscribeAuth?.();
    };
  }, [currentStep]);

  const checkAuthentication = async () => {
    try {
      setIsLoading(true);
      const auth = await window.electronAPI?.auth.check();
      setAuthStatus({ isAuthenticated: Boolean(auth), user: auth?.token });
      setIsLoading(false);
    } catch (err) {
      setError("Erreur lors de la vérification de l'authentification");
      setIsLoading(false);
    }
  };

  // Vérifier les permissions requises
  const checkPermissions = async () => {
    try {
      setIsLoading(true);
      const [status, _] = await Promise.all([
        window.electronAPI?.checkPermissionsSetup(),
        createDirectories(),
      ]);
      setPermissionsStatus(status);
      setIsLoading(false);
    } catch (err) {
      setError("Erreur lors de la vérification des permissions");
      setIsLoading(false);
    }
  };

  // Demander une permission spécifique
  const requestPermission = async (permission: string) => {
    try {
      setIsLoading(true);
      await window.electronAPI.requestPermission(permission);
      await checkPermissions(); // Vérifier à nouveau les permissions
      setIsLoading(false);
    } catch (err) {
      setError(`Erreur lors de la demande de permission: ${permission}`);
      setIsLoading(false);
    }
  };

  // Créer les répertoires nécessaires
  const createDirectories = async () => {
    try {
      const result = await window.electronAPI.createDirectories();
      setDirectoriesCreated(result);
    } catch (err) {}
  };

  const startAuthentication = async () => {
    try {
      setIsLoading(true);
      await window.electronAPI.auth.start();
      // Vérifier à nouveau l'authentification après la tentative de connexion
      await checkAuthentication();
      setIsLoading(false);
    } catch (err) {
      setError("Erreur lors de l'authentification");
      setIsLoading(false);
    }
  };

  // Terminer l'installation
  const completeSetup = async () => {
    try {
      setIsLoading(true);
      await window.electronAPI.completeSetup();
      setIsLoading(false);
    } catch (err) {
      console.log(err);
      setError("Erreur lors de la finalisation de l'installation");
      setIsLoading(false);
    }
  };

  // Passer à l'étape suivante
  const nextStep = () => {
    switch (currentStep) {
      case SetupStep.WELCOME:
        setCurrentStep(SetupStep.PERMISSIONS);
        break;
      case SetupStep.PERMISSIONS:
        setCurrentStep(SetupStep.AUTHENTICATION);
        break;
      case SetupStep.AUTHENTICATION:
        setCurrentStep(SetupStep.COMPLETE);
        break;
      case SetupStep.COMPLETE:
        completeSetup();
        break;
    }
  };

  // Rendu des différentes étapes
  const renderStep = () => {
    switch (currentStep) {
      case SetupStep.WELCOME:
        return (
          <div className="setup-step">
            <h2>Bienvenue dans l'assistant d'installation</h2>
            <p>
              Cet assistant vous guidera à travers les étapes nécessaires pour
              configurer l'application.
            </p>
            <Button size="md" onClick={nextStep} disabled={isLoading}>
              Commencer
            </Button>
          </div>
        );

      case SetupStep.PERMISSIONS:
        return (
          <div className="setup-step">
            <h2>Configuration des permissions</h2>
            <p>
              L'application a besoin des permissions suivantes pour fonctionner
              correctement :
            </p>

            <ul>
              {permissionsStatus ? (
                <li className="success">
                  Toutes les permissions sont accordées ✓
                </li>
              ) : (
                <li>
                  <button
                    type="button"
                    onClick={() => requestPermission("screen")}
                    disabled={isLoading}
                  >
                    Autoriser
                  </button>
                </li>
              )}
            </ul>

            <Button
              size="md"
              onClick={nextStep}
              disabled={isLoading || !permissionsStatus}
            >
              Continuer
            </Button>
          </div>
        );

      case SetupStep.AUTHENTICATION:
        return (
          <div className="setup-step">
            <h2>Connexion à votre compte</h2>
            {authStatus.isAuthenticated ? (
              <div>
                <p className="success">Vous êtes connecté ✓</p>

                <Button size="md" onClick={nextStep} disabled={isLoading}>
                  Continuer
                </Button>
              </div>
            ) : (
              <div>
                <p>Veuillez vous connecter à votre compte pour continuer.</p>
                <p className="note">
                  Cela vous permettra d'accéder à toutes les fonctionnalités de
                  l'application.
                </p>

                <Button
                  size="md"
                  onClick={startAuthentication}
                  disabled={isLoading}
                >
                  {isLoading ? "Connexion en cours..." : "Se connecter"}
                </Button>
              </div>
            )}
          </div>
        );

      case SetupStep.COMPLETE:
        return (
          <div className="setup-step">
            <h2>Installation terminée</h2>
            <p>
              L'application a été configurée avec succès. Vous pouvez maintenant
              commencer à l'utiliser.
            </p>

            <Button size="md" onClick={completeSetup} disabled={isLoading}>
              Démarrer l'application
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="setup-wizard">
      <div className="setup-progress">
        <div
          className={`progress-step ${
            currentStep === SetupStep.WELCOME ? "active" : ""
          }`}
        >
          1. Bienvenue
        </div>
        <div
          className={`progress-step ${
            currentStep === SetupStep.PERMISSIONS ? "active" : ""
          }`}
        >
          2. Permissions
        </div>
        <div
          className={`progress-step ${
            currentStep === SetupStep.AUTHENTICATION ? "active" : ""
          }`}
        >
          3. Compte
        </div>
        <div
          className={`progress-step ${
            currentStep === SetupStep.COMPLETE ? "active" : ""
          }`}
        >
          4. Terminé
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="setup-content">{renderStep()}</div>
    </div>
  );
};

export default SetupWizard;
