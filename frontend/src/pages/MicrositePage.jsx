import { useParams } from "react-router-dom";
import MicrositeApp from "../components/microsite/MicrositeApp";

export default function MicrositePage() {
  const { subdomain } = useParams();
  return <MicrositeApp subdomain={subdomain} />;
}
