from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token


class PinAuthView(APIView):
    """Authenticate using username/email + 4-digit pin_code and return token."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        identifier = request.data.get('username') or request.data.get('email')
        pin = request.data.get('pin_code')
        if not identifier or not pin:
            return Response({'detail': 'username/email and pin_code required'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        try:
            if '@' in identifier:
                user = User.objects.get(email__iexact=identifier)
            else:
                user = User.objects.get(username=identifier)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.pin_code or str(user.pin_code) != str(pin):
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': {'id': user.id, 'username': user.username, 'role': user.role.name if user.role else None}})
